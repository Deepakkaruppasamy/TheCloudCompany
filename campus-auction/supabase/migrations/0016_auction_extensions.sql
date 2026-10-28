-- Migration 0016: Anti-sniping last-minute auction extensions
-- Extends the auction by 60 seconds if a valid bid arrives in the final 30 seconds.
-- Capped at at most 20 extensions per auction (Decision D2).

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS extension_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_extended_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION place_bid(
  auction_id UUID,
  amount_paise BIGINT,
  idempotency_key UUID
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ;
  v_auction auctions%ROWTYPE;
  v_existing_bid bids%ROWTYPE;
  v_prev_leader_id UUID;
  v_prev_leader_bid_id UUID;
  v_new_bid_id UUID;
  v_min_amount BIGINT;
  v_extended BOOLEAN := FALSE;
  v_new_closes_at TIMESTAMPTZ;
  v_new_extension_count INT;
BEGIN
  -- Step 1: check actor
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  -- Step 2: Lock auction row
  SELECT * INTO v_auction FROM auctions WHERE id = place_bid.auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction_not_found'; END IF;

  -- Step 3: Read clock after lock
  v_now := clock_timestamp();

  -- Step 4: Idempotency check (before any other check)
  SELECT * INTO v_existing_bid FROM bids
  WHERE bids.auction_id = place_bid.auction_id
    AND bids.bidder_id = v_actor
    AND bids.idempotency_key = place_bid.idempotency_key;

  IF FOUND THEN
    RETURN json_build_object(
      'id', v_existing_bid.id,
      'amount_paise', v_existing_bid.amount_paise,
      'placed_at', v_existing_bid.placed_at,
      'replayed', true,
      'extended', false,
      'new_closes_at', v_auction.closes_at
    );
  END IF;

  -- Step 5: Eligibility
  IF NOT is_eligible_user() THEN RAISE EXCEPTION 'not_eligible'; END IF;

  -- Step 6: Auction checks
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction_not_active'; END IF;
  IF v_now < v_auction.opens_at THEN RAISE EXCEPTION 'auction_not_open'; END IF;
  IF v_now >= v_auction.closes_at THEN RAISE EXCEPTION 'auction_closed'; END IF;

  -- Step 7: Seller cannot bid
  IF v_auction.seller_id = v_actor THEN RAISE EXCEPTION 'seller_cannot_bid'; END IF;

  -- Step 8: Amount checks
  IF v_auction.current_price_paise IS NULL THEN
    v_min_amount := v_auction.starting_price_paise;
  ELSE
    v_min_amount := v_auction.current_price_paise + v_auction.minimum_increment_paise;
  END IF;

  IF place_bid.amount_paise < v_min_amount THEN
    RAISE EXCEPTION 'bid_too_low' USING DETAIL = format('minimum:%s', v_min_amount);
  END IF;

  -- Step 9: Find current leader for outbid notification
  IF v_auction.current_price_paise IS NOT NULL THEN
    SELECT bidder_id, id INTO v_prev_leader_id, v_prev_leader_bid_id
    FROM bids
    WHERE bids.auction_id = place_bid.auction_id
    ORDER BY bids.amount_paise DESC, bids.placed_at ASC, bids.id ASC
    LIMIT 1;
  END IF;

  -- Insert bid
  INSERT INTO bids (auction_id, bidder_id, amount_paise, idempotency_key)
  VALUES (place_bid.auction_id, v_actor, place_bid.amount_paise, place_bid.idempotency_key)
  RETURNING id INTO v_new_bid_id;

  -- Anti-sniping check: if within 30s of closing time and under 20-extension cap
  v_new_closes_at := v_auction.closes_at;
  IF (v_auction.closes_at - v_now) <= INTERVAL '30 seconds' AND COALESCE(v_auction.extension_count, 0) < 20 THEN
    v_new_closes_at := v_now + INTERVAL '60 seconds';
    v_extended := TRUE;
    v_new_extension_count := COALESCE(v_auction.extension_count, 0) + 1;

    UPDATE auctions
    SET current_price_paise = place_bid.amount_paise,
        first_bid_at = COALESCE(first_bid_at, v_now),
        closes_at = v_new_closes_at,
        extension_count = v_new_extension_count,
        last_extended_at = v_now
    WHERE id = place_bid.auction_id;

    -- Notify seller that auction was extended
    INSERT INTO notifications (recipient_id, type, auction_id, message)
    VALUES (
      v_auction.seller_id,
      'auction_extended',
      place_bid.auction_id,
      'Auction deadline extended by 60s due to a last-minute bid.'
    );
  ELSE
    UPDATE auctions
    SET current_price_paise = place_bid.amount_paise,
        first_bid_at = COALESCE(first_bid_at, v_now)
    WHERE id = place_bid.auction_id;
  END IF;

  -- Insert outbid notification for displaced leader (if different bidder)
  IF v_prev_leader_id IS NOT NULL AND v_prev_leader_id <> v_actor THEN
    INSERT INTO notifications (recipient_id, type, auction_id, bid_id, message)
    VALUES (
      v_prev_leader_id,
      'outbid',
      place_bid.auction_id,
      v_new_bid_id,
      format('You were outbid on auction. New leading bid: ₹%s', (place_bid.amount_paise::NUMERIC / 100)::TEXT)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object(
    'id', v_new_bid_id,
    'amount_paise', place_bid.amount_paise,
    'placed_at', v_now,
    'replayed', false,
    'extended', v_extended,
    'new_closes_at', v_new_closes_at
  );
END;
$$;

REVOKE ALL ON FUNCTION place_bid(UUID, BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_bid(UUID, BIGINT, UUID) TO authenticated;

