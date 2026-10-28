CREATE OR REPLACE FUNCTION approve_auction(transaction_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ;
  v_txn transactions%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_pickup_seconds BIGINT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  -- Lock transaction first, then auction (consistent order)
  SELECT * INTO v_txn FROM transactions WHERE id = approve_auction.transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = v_txn.auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  v_now := clock_timestamp();

  IF v_auction.seller_id <> v_actor THEN RAISE EXCEPTION 'not_seller'; END IF;
  IF v_txn.status <> 'pending_seller_approval' THEN RAISE EXCEPTION 'wrong_state'; END IF;
  IF v_now >= v_txn.seller_response_deadline_at THEN RAISE EXCEPTION 'deadline_expired'; END IF;

  -- Read pickup_seconds from system_config
  SELECT value_seconds INTO v_pickup_seconds FROM system_config WHERE key = 'pickup_seconds';
  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing' USING DETAIL = 'pickup_seconds'; END IF;

  UPDATE transactions
  SET status = 'reserved',
      seller_decision = 'approved',
      seller_decided_at = v_now,
      pickup_deadline_at = v_now + (v_pickup_seconds || ' seconds')::INTERVAL
  WHERE id = approve_auction.transaction_id;

  UPDATE auctions SET status = 'reserved' WHERE id = v_txn.auction_id;

  -- Notify winner
  INSERT INTO notifications (recipient_id, type, auction_id, transaction_id, message)
  VALUES (
    v_txn.winner_id,
    'seller_approved',
    v_txn.auction_id,
    approve_auction.transaction_id,
    format('The seller approved your winning bid. Please arrange pickup within the deadline.')
  ) ON CONFLICT DO NOTHING;

  RETURN json_build_object('result', 'approved');
END;
$$;

REVOKE ALL ON FUNCTION approve_auction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_auction(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION reject_auction(transaction_id UUID, reason TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ;
  v_txn transactions%ROWTYPE;
  v_auction auctions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF reason IS NULL OR btrim(reason) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(reason) > 300 THEN RAISE EXCEPTION 'reason_too_long'; END IF;

  SELECT * INTO v_txn FROM transactions WHERE id = reject_auction.transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = v_txn.auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  v_now := clock_timestamp();

  IF v_auction.seller_id <> v_actor THEN RAISE EXCEPTION 'not_seller'; END IF;
  IF v_txn.status <> 'pending_seller_approval' THEN RAISE EXCEPTION 'wrong_state'; END IF;
  IF v_now >= v_txn.seller_response_deadline_at THEN RAISE EXCEPTION 'deadline_expired'; END IF;

  UPDATE transactions
  SET status = 'rejected',
      seller_decision = 'rejected',
      seller_decided_at = v_now,
      outcome_reason = reason
  WHERE id = reject_auction.transaction_id;

  UPDATE auctions SET status = 'rejected' WHERE id = v_txn.auction_id;

  INSERT INTO notifications (recipient_id, type, auction_id, transaction_id, message)
  VALUES (
    v_txn.winner_id,
    'seller_rejected',
    v_txn.auction_id,
    reject_auction.transaction_id,
    format('The seller rejected your winning bid. Reason: %s', reason)
  ) ON CONFLICT DO NOTHING;

  RETURN json_build_object('result', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION reject_auction(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_auction(UUID, TEXT) TO authenticated;
