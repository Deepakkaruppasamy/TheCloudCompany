CREATE OR REPLACE FUNCTION confirm_handover(transaction_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ;
  v_txn transactions%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_is_seller BOOLEAN;
  v_is_winner BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_txn FROM transactions WHERE id = confirm_handover.transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = v_txn.auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  v_now := clock_timestamp();
  v_is_seller := (v_auction.seller_id = v_actor);
  v_is_winner := (v_txn.winner_id = v_actor);

  IF NOT (v_is_seller OR v_is_winner) THEN RAISE EXCEPTION 'not_party'; END IF;
  IF v_txn.status <> 'reserved' THEN RAISE EXCEPTION 'wrong_state'; END IF;
  IF v_now >= v_txn.pickup_deadline_at THEN RAISE EXCEPTION 'pickup_deadline_expired'; END IF;

  -- Check for duplicate confirmation
  IF v_is_seller AND v_txn.seller_confirmed_at IS NOT NULL THEN
    RETURN json_build_object('result', 'already_confirmed');
  END IF;
  IF v_is_winner AND v_txn.winner_confirmed_at IS NOT NULL THEN
    RETURN json_build_object('result', 'already_confirmed');
  END IF;

  -- Record confirmation
  UPDATE transactions
  SET seller_confirmed_at = CASE WHEN v_is_seller THEN v_now ELSE seller_confirmed_at END,
      winner_confirmed_at = CASE WHEN v_is_winner THEN v_now ELSE winner_confirmed_at END
  WHERE id = confirm_handover.transaction_id;

  -- Re-read to check both confirmations
  SELECT * INTO v_txn FROM transactions WHERE id = confirm_handover.transaction_id;

  IF v_txn.seller_confirmed_at IS NOT NULL AND v_txn.winner_confirmed_at IS NOT NULL THEN
    UPDATE transactions SET status = 'completed' WHERE id = confirm_handover.transaction_id;
    UPDATE auctions SET status = 'completed' WHERE id = v_txn.auction_id;

    -- Notify both parties
    INSERT INTO notifications (recipient_id, type, auction_id, transaction_id, message)
    VALUES
      (v_auction.seller_id, 'handover_completed', v_txn.auction_id, confirm_handover.transaction_id,
       'Handover confirmed by both parties. Transaction completed.'),
      (v_txn.winner_id, 'handover_completed', v_txn.auction_id, confirm_handover.transaction_id,
       'Handover confirmed by both parties. Transaction completed.')
    ON CONFLICT DO NOTHING;

    RETURN json_build_object('result', 'completed');
  END IF;

  RETURN json_build_object('result', 'partial');
END;
$$;

REVOKE ALL ON FUNCTION confirm_handover(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_handover(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION cancel_auction(auction_id UUID, reason TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ;
  v_auction auctions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF reason IS NULL OR btrim(reason) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(reason) > 300 THEN RAISE EXCEPTION 'reason_too_long'; END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = cancel_auction.auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction_not_found'; END IF;

  v_now := clock_timestamp();

  IF v_auction.seller_id <> v_actor THEN RAISE EXCEPTION 'not_seller'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'wrong_state'; END IF;
  IF v_auction.first_bid_at IS NOT NULL THEN RAISE EXCEPTION 'has_bids'; END IF;

  -- Extra safety: check bids table directly
  IF EXISTS (SELECT 1 FROM bids WHERE bids.auction_id = cancel_auction.auction_id) THEN
    RAISE EXCEPTION 'has_bids';
  END IF;

  UPDATE auctions
  SET status = 'cancelled_by_seller',
      cancelled_at = v_now,
      cancellation_reason = reason
  WHERE id = cancel_auction.auction_id;

  RETURN json_build_object('result', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION cancel_auction(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_auction(UUID, TEXT) TO authenticated;
