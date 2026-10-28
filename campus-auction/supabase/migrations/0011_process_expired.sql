-- Supporting tables
CREATE TABLE expiry_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  processed_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  error_summary TEXT NULL
);

ALTER TABLE expiry_runs ENABLE ROW LEVEL SECURITY;
-- No client policies — service_role only

CREATE TABLE reconcile_rate_limits (
  window_start TIMESTAMPTZ PRIMARY KEY,
  count INT NOT NULL DEFAULT 0
);

ALTER TABLE reconcile_rate_limits ENABLE ROW LEVEL SECURITY;
-- No client policies — service_role only

-- Rate check function
CREATE OR REPLACE FUNCTION reconcile_rate_check(max_per_minute INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Round down to the current minute
  v_window := date_trunc('minute', clock_timestamp());

  INSERT INTO reconcile_rate_limits (window_start, count)
  VALUES (v_window, 1)
  ON CONFLICT (window_start) DO UPDATE
    SET count = reconcile_rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= max_per_minute;
END;
$$;

REVOKE ALL ON FUNCTION reconcile_rate_check(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reconcile_rate_check(INT) TO service_role;

-- Main process_expired function
CREATE OR REPLACE FUNCTION process_expired(batch_size INT DEFAULT 50)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_batch_size INT;
  v_run_id UUID;
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_processed INT := 0;
  v_errors INT := 0;
  v_error_summary TEXT := '';
  v_auction_id UUID;
  v_txn transactions%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_close_result JSON;
  v_bidder_id UUID;
BEGIN
  -- Clamp batch_size
  v_batch_size := GREATEST(1, LEAST(100, batch_size));

  -- Create run record
  INSERT INTO expiry_runs (started_at) VALUES (v_started_at) RETURNING id INTO v_run_id;

  -- Step 1: Expired active auctions
  FOR v_auction_id IN
    SELECT id FROM auctions
    WHERE status = 'active' AND closes_at <= clock_timestamp()
    ORDER BY closes_at
    LIMIT v_batch_size
  LOOP
    BEGIN
      SELECT close_auction(v_auction_id) INTO v_close_result;
      IF (v_close_result->>'result') <> 'noop' THEN
        v_processed := v_processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_summary := v_error_summary || format('close(%s): %s; ', v_auction_id, SQLERRM);
    END;
  END LOOP;

  -- Step 2: Expired seller responses
  FOR v_txn IN
    SELECT t.* FROM transactions t
    WHERE t.status = 'pending_seller_approval'
      AND t.seller_response_deadline_at <= clock_timestamp()
    ORDER BY t.seller_response_deadline_at
    LIMIT v_batch_size
  LOOP
    BEGIN
      -- Lock transaction then auction
      SELECT * INTO v_txn FROM transactions WHERE id = v_txn.id FOR UPDATE;
      SELECT * INTO v_auction FROM auctions WHERE id = v_txn.auction_id FOR UPDATE;
      v_now := clock_timestamp();

      -- Recheck after lock
      IF v_txn.status = 'pending_seller_approval' AND v_now >= v_txn.seller_response_deadline_at THEN
        UPDATE transactions
        SET status = 'seller_unresponsive',
            outcome_reason = 'Seller response deadline expired'
        WHERE id = v_txn.id;

        UPDATE auctions SET status = 'seller_unresponsive' WHERE id = v_txn.auction_id;

        INSERT INTO notifications (recipient_id, type, auction_id, transaction_id, message)
        VALUES (
          v_txn.winner_id, 'seller_unresponsive', v_txn.auction_id, v_txn.id,
          'The seller did not respond in time. Transaction cancelled.'
        ) ON CONFLICT DO NOTHING;

        v_processed := v_processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_summary := v_error_summary || format('seller_unresponsive(%s): %s; ', v_txn.id, SQLERRM);
    END;
  END LOOP;

  -- Step 3: Expired pickups
  FOR v_txn IN
    SELECT t.* FROM transactions t
    WHERE t.status = 'reserved'
      AND t.pickup_deadline_at <= clock_timestamp()
    ORDER BY t.pickup_deadline_at
    LIMIT v_batch_size
  LOOP
    BEGIN
      SELECT * INTO v_txn FROM transactions WHERE id = v_txn.id FOR UPDATE;
      SELECT * INTO v_auction FROM auctions WHERE id = v_txn.auction_id FOR UPDATE;
      v_now := clock_timestamp();

      IF v_txn.status = 'reserved' AND v_now >= v_txn.pickup_deadline_at THEN
        UPDATE transactions
        SET status = 'failed_pickup',
            outcome_reason = 'Pickup deadline expired'
        WHERE id = v_txn.id;

        UPDATE auctions SET status = 'failed_pickup' WHERE id = v_txn.auction_id;

        -- Notify both parties
        INSERT INTO notifications (recipient_id, type, auction_id, transaction_id, message)
        VALUES
          (v_auction.seller_id, 'failed_pickup', v_txn.auction_id, v_txn.id,
           'Pickup deadline passed. Transaction marked as failed.'),
          (v_txn.winner_id, 'failed_pickup', v_txn.auction_id, v_txn.id,
           'Pickup deadline passed. Transaction marked as failed.')
        ON CONFLICT DO NOTHING;

        INSERT INTO notifications (recipient_id, type, auction_id, transaction_id, message)
        VALUES
          (v_auction.seller_id, 'pickup_deadline', v_txn.auction_id, v_txn.id,
           'Pickup deadline has expired for a reserved transaction.'),
          (v_txn.winner_id, 'pickup_deadline', v_txn.auction_id, v_txn.id,
           'Pickup deadline has expired for your reserved transaction.')
        ON CONFLICT DO NOTHING;

        v_processed := v_processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_summary := v_error_summary || format('failed_pickup(%s): %s; ', v_txn.id, SQLERRM);
    END;
  END LOOP;

  -- Step 4: Closing-soon scan (bidders on auctions closing within 24 hours)
  FOR v_auction_id, v_bidder_id IN
    SELECT DISTINCT b.auction_id, b.bidder_id
    FROM bids b
    JOIN auctions a ON a.id = b.auction_id
    WHERE a.status = 'active'
      AND a.closes_at BETWEEN clock_timestamp() AND clock_timestamp() + INTERVAL '24 hours'
    LIMIT v_batch_size
  LOOP
    BEGIN
      INSERT INTO notifications (recipient_id, type, auction_id, message)
      SELECT v_bidder_id, 'closing_soon', v_auction_id,
             format('An auction you bid on is closing soon.')
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Step 5: Write expiry_runs result
  UPDATE expiry_runs
  SET finished_at = clock_timestamp(),
      status = CASE WHEN v_errors > 0 THEN 'error' ELSE 'ok' END,
      processed_count = v_processed,
      error_count = v_errors,
      error_summary = CASE WHEN v_errors > 0 
                           THEN left(v_error_summary, 1000)
                           ELSE NULL END
  WHERE id = v_run_id;

  RETURN json_build_object(
    'run_id', v_run_id,
    'processed', v_processed,
    'errors', v_errors,
    'status', CASE WHEN v_errors > 0 THEN 'error' ELSE 'ok' END
  );
END;
$$;

REVOKE ALL ON FUNCTION process_expired(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_expired(INT) TO service_role;
