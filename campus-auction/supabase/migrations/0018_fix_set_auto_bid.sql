-- Migration 0018: Fix ambiguous column reference in set_auto_bid
-- Resolves Postgres error 42702 ("column reference auction_id is ambiguous")

-- 1. Update resolve_auto_bids to guard against NULL initial lead amounts
CREATE OR REPLACE FUNCTION resolve_auto_bids(
  p_auction_id UUID,
  p_now TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_auction auctions%ROWTYPE;
  v_top1 auto_bids%ROWTYPE;
  v_top2 auto_bids%ROWTYPE;
  v_count INT := 0;
  v_lead_bidder_id UUID;
  v_lead_amount BIGINT := 0;
  v_target_price BIGINT;
  v_comp_price BIGINT;
  v_new_bid_id UUID;
  v_new_closes_at TIMESTAMPTZ;
  v_extended BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND OR v_auction.status <> 'active' THEN
    RETURN json_build_object('resolved', false);
  END IF;

  -- Read current leading bid
  SELECT bidder_id, amount_paise INTO v_lead_bidder_id, v_lead_amount
  FROM bids
  WHERE auction_id = p_auction_id
  ORDER BY amount_paise DESC, placed_at ASC, id ASC
  LIMIT 1;

  v_lead_amount := COALESCE(v_lead_amount, 0);

  -- Read top 2 proxy bids
  SELECT * INTO v_top1
  FROM auto_bids
  WHERE auction_id = p_auction_id
  ORDER BY max_amount_paise DESC, created_at ASC, id ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('resolved', false);
  END IF;

  SELECT * INTO v_top2
  FROM auto_bids
  WHERE auction_id = p_auction_id AND id <> v_top1.id
  ORDER BY max_amount_paise DESC, created_at ASC, id ASC
  LIMIT 1;

  -- Calculate target winning price for top1
  IF v_top2.id IS NULL THEN
    -- Single proxy bidder
    IF v_lead_amount = 0 THEN
      v_target_price := v_auction.starting_price_paise;
    ELSIF v_lead_bidder_id = v_top1.bidder_id THEN
      v_target_price := v_lead_amount; -- Already leading
    ELSE
      v_target_price := LEAST(v_top1.max_amount_paise, v_lead_amount + v_auction.minimum_increment_paise);
    END IF;
  ELSE
    -- Competitive proxies
    IF v_top1.max_amount_paise = v_top2.max_amount_paise THEN
      v_target_price := v_top1.max_amount_paise; -- Tie broken by earliest created_at
    ELSE
      v_comp_price := v_top2.max_amount_paise + v_auction.minimum_increment_paise;
      v_target_price := LEAST(v_top1.max_amount_paise, GREATEST(v_comp_price, GREATEST(v_lead_amount, v_auction.starting_price_paise)));
    END IF;
  END IF;

  -- Ensure target price is at least starting price
  v_target_price := GREATEST(v_target_price, v_auction.starting_price_paise);

  -- Only place bid if top1 is not already leading at or above target price
  IF (v_lead_bidder_id IS DISTINCT FROM v_top1.bidder_id OR v_lead_amount < v_target_price) AND v_target_price <= v_top1.max_amount_paise THEN
    -- Insert proxy bid
    INSERT INTO bids (auction_id, bidder_id, amount_paise, idempotency_key)
    VALUES (p_auction_id, v_top1.bidder_id, v_target_price, gen_random_uuid())
    RETURNING id INTO v_new_bid_id;

    -- Check last-minute extension (anti-sniping)
    v_new_closes_at := v_auction.closes_at;
    IF (v_auction.closes_at - p_now) <= INTERVAL '30 seconds' AND COALESCE(v_auction.extension_count, 0) < 20 THEN
      v_new_closes_at := p_now + INTERVAL '60 seconds';
      v_extended := TRUE;

      UPDATE auctions
      SET current_price_paise = v_target_price,
          first_bid_at = COALESCE(first_bid_at, p_now),
          closes_at = v_new_closes_at,
          extension_count = COALESCE(extension_count, 0) + 1,
          last_extended_at = p_now
      WHERE id = p_auction_id;

      INSERT INTO notifications (recipient_id, type, auction_id, message)
      VALUES (v_auction.seller_id, 'auction_extended', p_auction_id, 'Auction deadline extended by 60s due to automatic proxy bid.');
    ELSE
      UPDATE auctions
      SET current_price_paise = v_target_price,
          first_bid_at = COALESCE(first_bid_at, p_now)
      WHERE id = p_auction_id;
    END IF;

    -- Notify outbid manual leader or proxy
    IF v_lead_bidder_id IS NOT NULL AND v_lead_bidder_id <> v_top1.bidder_id THEN
      INSERT INTO notifications (recipient_id, type, auction_id, bid_id, message)
      VALUES (
        v_lead_bidder_id,
        'proxy_outbid',
        p_auction_id,
        v_new_bid_id,
        format('An automatic bid outbid you. New leading bid: ₹%s', (v_target_price::NUMERIC / 100)::TEXT)
      )
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_top2.id IS NOT NULL AND v_top2.bidder_id <> v_top1.bidder_id AND v_top2.bidder_id <> v_lead_bidder_id THEN
      INSERT INTO notifications (recipient_id, type, auction_id, message)
      VALUES (
        v_top2.bidder_id,
        'proxy_outbid',
        p_auction_id,
        format('Your auto-bid max was exceeded. Leading bid is now ₹%s', (v_target_price::NUMERIC / 100)::TEXT)
      );
    END IF;

    RETURN json_build_object(
      'resolved', true,
      'winning_bidder', v_top1.bidder_id,
      'amount_paise', v_target_price,
      'extended', v_extended
    );
  END IF;

  RETURN json_build_object('resolved', false, 'amount_paise', v_lead_amount);
END;
$$;

-- 2. Core function using p_ prefix to avoid column name conflicts
CREATE OR REPLACE FUNCTION set_auto_bid(
  p_auction_id UUID,
  p_max_amount_paise BIGINT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMPTZ;
  v_auction auctions%ROWTYPE;
  v_min_amount BIGINT;
  v_res JSON;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT is_eligible_user() THEN RAISE EXCEPTION 'not_eligible'; END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction_not_found'; END IF;

  v_now := clock_timestamp();

  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction_not_active'; END IF;
  IF v_now < v_auction.opens_at THEN RAISE EXCEPTION 'auction_not_open'; END IF;
  IF v_now >= v_auction.closes_at THEN RAISE EXCEPTION 'auction_closed'; END IF;
  IF v_auction.seller_id = v_actor THEN RAISE EXCEPTION 'seller_cannot_bid'; END IF;

  -- Validate max_amount_paise
  IF v_auction.current_price_paise IS NULL THEN
    v_min_amount := v_auction.starting_price_paise;
  ELSE
    v_min_amount := v_auction.current_price_paise + v_auction.minimum_increment_paise;
  END IF;

  IF p_max_amount_paise < v_min_amount THEN
    RAISE EXCEPTION 'auto_bid_too_low' USING DETAIL = format('minimum:%s', v_min_amount);
  END IF;

  -- Upsert auto_bid row (confidential to caller)
  INSERT INTO auto_bids (auction_id, bidder_id, max_amount_paise, updated_at)
  VALUES (p_auction_id, v_actor, p_max_amount_paise, v_now)
  ON CONFLICT (auction_id, bidder_id)
  DO UPDATE SET
    max_amount_paise = EXCLUDED.max_amount_paise,
    updated_at = v_now;

  -- Run proxy resolution engine immediately
  v_res := resolve_auto_bids(p_auction_id, v_now);

  RETURN json_build_object(
    'ok', true,
    'auction_id', p_auction_id,
    'max_amount_paise', p_max_amount_paise,
    'resolution', v_res
  );
END;
$$;

-- 3. Overload supporting un-prefixed auction_id parameter for backward compatibility
CREATE OR REPLACE FUNCTION set_auto_bid(
  auction_id UUID,
  max_amount_paise BIGINT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN set_auto_bid(p_auction_id => auction_id, p_max_amount_paise => max_amount_paise);
END;
$$;

REVOKE ALL ON FUNCTION set_auto_bid(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_auto_bid(UUID, BIGINT) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
