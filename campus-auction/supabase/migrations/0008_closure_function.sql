CREATE OR REPLACE FUNCTION close_auction(auction_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_auction auctions%ROWTYPE;
  v_winning_bid bids%ROWTYPE;
  v_seller_response_seconds BIGINT;
BEGIN
  -- Step 1: Lock auction row
  SELECT * INTO v_auction FROM auctions WHERE id = close_auction.auction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('result', 'noop'); END IF;

  v_now := clock_timestamp();

  -- Step 2: Guard
  IF v_auction.status <> 'active' OR v_now < v_auction.closes_at THEN
    RETURN json_build_object('result', 'noop');
  END IF;

  -- Step 3: Select winning bid (placed_at < closes_at only)
  SELECT * INTO v_winning_bid
  FROM bids
  WHERE bids.auction_id = close_auction.auction_id
    AND placed_at < v_auction.closes_at
  ORDER BY amount_paise DESC, placed_at ASC, id ASC
  LIMIT 1;

  -- Step 4: No bids
  IF NOT FOUND THEN
    UPDATE auctions SET status = 'closed_unsold' WHERE id = close_auction.auction_id;
    INSERT INTO notifications (recipient_id, type, auction_id, message)
    VALUES (
      v_auction.seller_id,
      'auction_unsold',
      close_auction.auction_id,
      format('Your auction "%s" ended with no bids.', v_auction.title)
    ) ON CONFLICT DO NOTHING;
    RETURN json_build_object('result', 'unsold');
  END IF;

  -- Step 5: Winner found — read system_config
  SELECT value_seconds INTO v_seller_response_seconds
  FROM system_config WHERE key = 'seller_response_seconds';

  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing' USING DETAIL = 'seller_response_seconds'; END IF;

  -- Create transaction
  INSERT INTO transactions (
    auction_id, winner_id, winning_bid_id, final_amount_paise,
    status, seller_response_deadline_at
  ) VALUES (
    close_auction.auction_id,
    v_winning_bid.bidder_id,
    v_winning_bid.id,
    v_winning_bid.amount_paise,
    'pending_seller_approval',
    v_now + (v_seller_response_seconds || ' seconds')::INTERVAL
  );

  -- Update auction status
  UPDATE auctions SET status = 'pending_seller_approval' WHERE id = close_auction.auction_id;

  -- Notify winner
  INSERT INTO notifications (recipient_id, type, auction_id, message)
  VALUES (
    v_winning_bid.bidder_id,
    'auction_won',
    close_auction.auction_id,
    format('Congratulations! You won "%s" with a bid of ₹%s. Awaiting seller approval.', 
           v_auction.title, (v_winning_bid.amount_paise::NUMERIC / 100)::TEXT)
  ) ON CONFLICT DO NOTHING;

  -- Notify seller
  INSERT INTO notifications (recipient_id, type, auction_id, message)
  VALUES (
    v_auction.seller_id,
    'seller_approval_needed',
    close_auction.auction_id,
    format('Your auction "%s" ended. Please approve or reject the winning bid of ₹%s.',
           v_auction.title, (v_winning_bid.amount_paise::NUMERIC / 100)::TEXT)
  ) ON CONFLICT DO NOTHING;

  RETURN json_build_object('result', 'winner_selected');
END;
$$;

-- Internal function — no client grant
REVOKE ALL ON FUNCTION close_auction(UUID) FROM PUBLIC;
