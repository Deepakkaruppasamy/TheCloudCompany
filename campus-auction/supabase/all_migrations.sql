-- Create set_updated_at trigger function (used by all tables with updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

-- system_config table
CREATE TABLE system_config (
  key TEXT PRIMARY KEY CHECK (key IN ('seller_response_seconds', 'pickup_seconds')),
  value_seconds BIGINT NOT NULL CHECK (value_seconds > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Enable RLS on system_config (no client policies — service_role only)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 60),
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'student', 'admin')),
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to keep updated_at current
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role, is_verified, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    TRUE,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        role = COALESCE(EXCLUDED.role, profiles.role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_new_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- is_eligible_user helper
CREATE OR REPLACE FUNCTION is_eligible_user()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_verified BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT is_verified, account_status
  INTO v_verified, v_status
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN RETURN TRUE; END IF;
  RETURN COALESCE(v_status, 'active') = 'active';
END;
$$;

REVOKE ALL ON FUNCTION is_eligible_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_eligible_user() TO authenticated;
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 10 AND 2000),
  category TEXT NOT NULL CHECK (category IN ('cycle', 'calculator', 'books', 'electronics', 'other')),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'for_parts')),
  photo_path TEXT NULL,
  starting_price_paise BIGINT NOT NULL CHECK (starting_price_paise > 0),
  minimum_increment_paise BIGINT NOT NULL CHECK (minimum_increment_paise > 0),
  current_price_paise BIGINT NULL CHECK (current_price_paise IS NULL OR current_price_paise > 0),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL CHECK (closes_at > opens_at),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'closed_unsold', 'pending_seller_approval', 'reserved', 
    'rejected', 'seller_unresponsive', 'failed_pickup', 'completed', 'cancelled_by_seller'
  )),
  first_bid_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancellation_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  -- Consistency constraints
  CONSTRAINT chk_cancelled_has_no_first_bid CHECK (
    first_bid_at IS NULL OR status <> 'cancelled_by_seller'
  ),
  CONSTRAINT chk_cancelled_at_matches_status CHECK (
    (cancelled_at IS NULL) = (status <> 'cancelled_by_seller')
  )
);

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_auctions_updated_at
  BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX idx_auctions_status_closes_at ON auctions(status, closes_at);
CREATE INDEX idx_auctions_seller_id ON auctions(seller_id);
CREATE INDEX idx_auctions_fts ON auctions USING GIN(to_tsvector('english', title || ' ' || description));

-- create_auction function
CREATE OR REPLACE FUNCTION create_auction(
  title TEXT,
  description TEXT,
  category TEXT,
  condition TEXT,
  starting_price_paise BIGINT,
  minimum_increment_paise BIGINT,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  photo_path TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT is_eligible_user() THEN RAISE EXCEPTION 'not_eligible'; END IF;
  IF starting_price_paise <= 0 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF minimum_increment_paise <= 0 THEN RAISE EXCEPTION 'invalid_increment'; END IF;
  IF closes_at <= clock_timestamp() THEN RAISE EXCEPTION 'closes_at_in_past'; END IF;
  IF closes_at <= opens_at THEN RAISE EXCEPTION 'closes_at_before_opens_at'; END IF;
  -- Validate photo_path belongs to the caller's folder
  IF photo_path IS NOT NULL AND photo_path NOT LIKE (v_actor::TEXT || '/%') THEN
    RAISE EXCEPTION 'photo_path_forbidden';
  END IF;

  INSERT INTO auctions (
    seller_id, title, description, category, condition,
    starting_price_paise, minimum_increment_paise, opens_at, closes_at, photo_path
  ) VALUES (
    v_actor, title, description, category, condition,
    starting_price_paise, minimum_increment_paise, opens_at, closes_at, photo_path
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION create_auction(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_auction(TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- edit_auction function
CREATE OR REPLACE FUNCTION edit_auction(
  auction_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  condition TEXT,
  photo_path TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_row auctions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_row FROM auctions WHERE id = auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction_not_found'; END IF;
  IF v_row.seller_id <> v_actor THEN RAISE EXCEPTION 'not_seller'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'wrong_state'; END IF;
  IF v_row.first_bid_at IS NOT NULL THEN RAISE EXCEPTION 'auction_has_bids'; END IF;
  IF clock_timestamp() >= v_row.closes_at THEN RAISE EXCEPTION 'auction_closed'; END IF;

  -- Validate photo_path belongs to the caller's folder
  IF photo_path IS NOT NULL AND photo_path NOT LIKE (v_actor::TEXT || '/%') THEN
    RAISE EXCEPTION 'photo_path_forbidden';
  END IF;

  UPDATE auctions
  SET title = edit_auction.title,
      description = edit_auction.description,
      category = edit_auction.category,
      condition = edit_auction.condition,
      photo_path = edit_auction.photo_path
  WHERE id = auction_id;
END;
$$;

REVOKE ALL ON FUNCTION edit_auction(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION edit_auction(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  bidder_id UUID NOT NULL REFERENCES profiles(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  idempotency_key UUID NOT NULL,
  UNIQUE (auction_id, bidder_id, idempotency_key)
);

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount_paise DESC, placed_at ASC);
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL UNIQUE REFERENCES auctions(id),
  winner_id UUID NOT NULL REFERENCES profiles(id),
  winning_bid_id UUID NOT NULL REFERENCES bids(id),
  final_amount_paise BIGINT NOT NULL CHECK (final_amount_paise > 0),
  status TEXT NOT NULL CHECK (status IN (
    'pending_seller_approval', 'reserved', 'rejected', 
    'seller_unresponsive', 'failed_pickup', 'completed'
  )),
  seller_response_deadline_at TIMESTAMPTZ NOT NULL,
  pickup_deadline_at TIMESTAMPTZ NULL,
  seller_decision TEXT NULL CHECK (seller_decision IN ('approved', 'rejected')),
  seller_decided_at TIMESTAMPTZ NULL,
  seller_confirmed_at TIMESTAMPTZ NULL,
  winner_confirmed_at TIMESTAMPTZ NULL,
  outcome_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'auction_won', 'auction_unsold', 'seller_approval_needed',
    'seller_approved', 'seller_rejected', 'seller_unresponsive',
    'pickup_deadline', 'failed_pickup', 'handover_completed',
    'auction_cancelled', 'outbid', 'closing_soon',
    'listing_created', 'listing_updated', 'bid_placed', 'bid_received'
  )),
  auction_id UUID NULL REFERENCES auctions(id) ON DELETE CASCADE,
  transaction_id UUID NULL REFERENCES transactions(id) ON DELETE CASCADE,
  bid_id UUID NULL REFERENCES bids(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  read_at TIMESTAMPTZ NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Deduplication indexes
CREATE UNIQUE INDEX idx_notif_closing_soon_dedup
  ON notifications(recipient_id, auction_id) WHERE type = 'closing_soon';

CREATE UNIQUE INDEX idx_notif_outbid_dedup
  ON notifications(recipient_id, bid_id) WHERE type = 'outbid';

CREATE UNIQUE INDEX idx_notif_txn_type_dedup
  ON notifications(recipient_id, transaction_id, type) WHERE transaction_id IS NOT NULL;

-- Query indexes
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
-- ── Profiles RLS ─────────────────────────────────────────────────────────────
-- Own row read
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Allow display_name and role update
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant update on display_name and role to authenticated
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, role) ON profiles TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- ── Auctions RLS ─────────────────────────────────────────────────────────────
CREATE POLICY "auctions_select_authenticated" ON auctions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- No INSERT, UPDATE, or DELETE grants to clients — all via functions

-- ── Bids RLS ─────────────────────────────────────────────────────────────────
-- No direct grants; read only through bid_history view

-- ── Transactions RLS ─────────────────────────────────────────────────────────
CREATE POLICY "transactions_select_winner_or_seller" ON transactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = winner_id
    OR auth.uid() = (SELECT seller_id FROM auctions WHERE auctions.id = transactions.auction_id)
  );

-- ── Notifications RLS ─────────────────────────────────────────────────────────
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "notifications_update_read_at" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Column-level: only read_at can be updated
REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (read_at) ON notifications TO authenticated;
GRANT SELECT ON notifications TO authenticated;

-- Grant SELECT on auctions and transactions to authenticated
GRANT SELECT ON auctions TO authenticated;
GRANT SELECT ON transactions TO authenticated;

-- ── public_profiles view ──────────────────────────────────────────────────────
CREATE VIEW public_profiles WITH (security_barrier = true) AS
  SELECT id, display_name FROM profiles;

GRANT SELECT ON public_profiles TO authenticated;

-- ── bid_history view ──────────────────────────────────────────────────────────
CREATE VIEW bid_history WITH (security_barrier = true) AS
  SELECT
    b.auction_id,
    p.display_name,
    b.amount_paise,
    b.placed_at
  FROM bids b
  JOIN public_profiles p ON p.id = b.bidder_id;

GRANT SELECT ON bid_history TO authenticated;

-- ── public_stats function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public_stats()
RETURNS JSON LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT json_build_object(
    'active_auctions', COUNT(*)
  )
  FROM auctions
  WHERE status = 'active';
$$;

REVOKE ALL ON FUNCTION public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public_stats() TO authenticated;

-- ── Storage bucket (documented; actual creation via Supabase dashboard or CLI) ─
-- Bucket: listing-photos (private)
-- Policy: authenticated users insert only into <user_id>/... folder
-- Policy: authenticated users delete only their own objects  
-- Reads via short-lived signed URLs from server
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
      'replayed', true
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

  -- Update auction price and first_bid_at
  UPDATE auctions
  SET current_price_paise = place_bid.amount_paise,
      first_bid_at = COALESCE(first_bid_at, v_now)
  WHERE id = place_bid.auction_id;

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
    'replayed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION place_bid(UUID, BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_bid(UUID, BIGINT, UUID) TO authenticated;
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
-- ==============================================================================
-- Campus Auction — Phase 2 Stage 2 Migrations (0012 to 0015)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/orovkmsuacamgucuuwmc/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0012_notification_types.sql
-- ------------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'auction_won', 'auction_unsold', 'seller_approval_needed',
  'seller_approved', 'seller_rejected', 'seller_unresponsive',
  'pickup_deadline', 'failed_pickup', 'handover_completed',
  'auction_cancelled', 'outbid', 'closing_soon',
  'listing_created', 'listing_updated', 'bid_placed', 'bid_received',
  'question_asked', 'question_answered', 'saved_search_match',
  'auction_extended', 'proxy_outbid'
));

-- ------------------------------------------------------------------------------
-- 0013_auction_questions.sql
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auction_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  asker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(btrim(question)) BETWEEN 5 AND 500),
  answer TEXT NULL CHECK (answer IS NULL OR char_length(btrim(answer)) BETWEEN 1 AND 1000),
  answered_at TIMESTAMPTZ NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auction_questions_auction_created ON auction_questions(auction_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_auction_questions_asker_created ON auction_questions(asker_id, created_at DESC);

-- Row Level Security
ALTER TABLE auction_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read questions" ON auction_questions;
CREATE POLICY "Allow read questions" ON auction_questions
  FOR SELECT TO authenticated
  USING (
    is_hidden = FALSE
    OR asker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM auctions a WHERE a.id = auction_questions.auction_id AND a.seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

-- View with column-level visibility: Asker display name only (masks phone, email, and internal profile details)
CREATE OR REPLACE VIEW auction_questions_public AS
SELECT
  q.id,
  q.auction_id,
  p.display_name AS asker_display_name,
  q.question,
  q.answer,
  q.answered_at,
  q.is_hidden,
  q.hidden_reason,
  q.created_at,
  q.asker_id
FROM auction_questions q
JOIN profiles p ON p.id = q.asker_id;

-- Function: ask_question
CREATE OR REPLACE FUNCTION ask_question(
  auction_id UUID,
  question TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_verified BOOLEAN;
  v_seller_id UUID;
  v_status TEXT;
  v_clean_q TEXT;
  v_count INT;
  v_last_asked TIMESTAMPTZ;
  v_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  -- Must be eligible and verified buyer
  IF NOT is_eligible_user() THEN RAISE EXCEPTION 'not_eligible'; END IF;
  SELECT is_verified INTO v_verified FROM profiles WHERE id = v_actor;
  IF NOT COALESCE(v_verified, FALSE) THEN RAISE EXCEPTION 'not_verified'; END IF;

  -- Validate question length
  v_clean_q := btrim(question);
  IF char_length(v_clean_q) < 5 OR char_length(v_clean_q) > 500 THEN
    RAISE EXCEPTION 'invalid_question_length';
  END IF;

  -- Check auction
  SELECT seller_id, status INTO v_seller_id, v_status
  FROM auctions
  WHERE id = ask_question.auction_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'auction_not_found'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'auction_not_active'; END IF;

  -- Seller cannot ask questions on their own auction
  IF v_actor = v_seller_id THEN RAISE EXCEPTION 'seller_cannot_ask'; END IF;

  -- Quota guard: at most 5 questions per auction per buyer
  SELECT count(*) INTO v_count
  FROM auction_questions
  WHERE auction_questions.auction_id = ask_question.auction_id
    AND auction_questions.asker_id = v_actor;

  IF v_count >= 5 THEN RAISE EXCEPTION 'max_questions_exceeded'; END IF;

  -- Durable rate limiter: at most 1 question per minute per buyer
  SELECT max(created_at) INTO v_last_asked
  FROM auction_questions
  WHERE auction_questions.asker_id = v_actor;

  IF v_last_asked IS NOT NULL AND v_last_asked > (clock_timestamp() - INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  -- Insert question
  INSERT INTO auction_questions (
    auction_id,
    asker_id,
    question
  ) VALUES (
    ask_question.auction_id,
    v_actor,
    v_clean_q
  ) RETURNING id INTO v_id;

  -- Notify seller
  INSERT INTO notifications (
    recipient_id,
    type,
    auction_id,
    message
  ) VALUES (
    v_seller_id,
    'question_asked',
    ask_question.auction_id,
    'A buyer asked a question on your listing.'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION ask_question(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ask_question(UUID, TEXT) TO authenticated;

-- Function: answer_question
CREATE OR REPLACE FUNCTION answer_question(
  question_id UUID,
  answer TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_auction_id UUID;
  v_seller_id UUID;
  v_asker_id UUID;
  v_existing_ans TEXT;
  v_clean_ans TEXT;
  v_auction_title TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  v_clean_ans := btrim(answer);
  IF char_length(v_clean_ans) < 1 OR char_length(v_clean_ans) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer_length';
  END IF;

  SELECT q.auction_id, q.asker_id, q.answer, a.seller_id, a.title
  INTO v_auction_id, v_asker_id, v_existing_ans, v_seller_id, v_auction_title
  FROM auction_questions q
  JOIN auctions a ON a.id = q.auction_id
  WHERE q.id = answer_question.question_id
  FOR UPDATE OF q;

  IF NOT FOUND THEN RAISE EXCEPTION 'question_not_found'; END IF;
  IF v_actor <> v_seller_id THEN RAISE EXCEPTION 'only_seller_can_answer'; END IF;
  IF v_existing_ans IS NOT NULL THEN RAISE EXCEPTION 'already_answered'; END IF;

  UPDATE auction_questions
  SET answer = v_clean_ans,
      answered_at = clock_timestamp()
  WHERE id = answer_question.question_id;

  -- Notify asker
  INSERT INTO notifications (
    recipient_id,
    type,
    auction_id,
    message
  ) VALUES (
    v_asker_id,
    'question_answered',
    v_auction_id,
    'The seller answered your question on "' || left(v_auction_title, 40) || '".'
  );
END;
$$;

REVOKE ALL ON FUNCTION answer_question(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION answer_question(UUID, TEXT) TO authenticated;

-- Function: hide_question
CREATE OR REPLACE FUNCTION hide_question(
  question_id UUID,
  reason TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_seller_id UUID;
  v_is_admin BOOLEAN;
  v_clean_reason TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  v_clean_reason := btrim(reason);
  IF char_length(v_clean_reason) < 1 THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  SELECT a.seller_id INTO v_seller_id
  FROM auction_questions q
  JOIN auctions a ON a.id = q.auction_id
  WHERE q.id = hide_question.question_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'question_not_found'; END IF;

  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_actor;

  IF v_actor <> v_seller_id AND COALESCE(v_is_admin, FALSE) = FALSE THEN
    RAISE EXCEPTION 'not_authorized_to_hide';
  END IF;

  UPDATE auction_questions
  SET is_hidden = TRUE,
      hidden_reason = v_clean_reason
  WHERE id = hide_question.question_id;
END;
$$;

REVOKE ALL ON FUNCTION hide_question(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hide_question(UUID, TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- 0014_saved_searches.sql
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  keyword TEXT NOT NULL CHECK (char_length(btrim(keyword)) BETWEEN 2 AND 100),
  category TEXT NULL CHECK (category IS NULL OR category IN ('cycle', 'calculator', 'books', 'electronics', 'other')),
  max_price_paise BIGINT NULL CHECK (max_price_paise IS NULL OR max_price_paise > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_active ON saved_searches(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_saved_searches_active_category ON saved_searches(category) WHERE is_active = TRUE;

-- Row Level Security
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own saved searches" ON saved_searches;
CREATE POLICY "Users can manage their own saved searches" ON saved_searches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enforce at most 10 active saved searches per user
CREATE OR REPLACE FUNCTION check_saved_search_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.is_active = TRUE THEN
    SELECT count(*) INTO v_count
    FROM saved_searches
    WHERE user_id = NEW.user_id
      AND is_active = TRUE
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_count >= 10 THEN
      RAISE EXCEPTION 'max_saved_searches_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saved_search_limit ON saved_searches;
CREATE TRIGGER trg_saved_search_limit
  BEFORE INSERT OR UPDATE ON saved_searches
  FOR EACH ROW EXECUTE FUNCTION check_saved_search_limit();

-- Function: create_saved_search
CREATE OR REPLACE FUNCTION create_saved_search(
  name TEXT,
  keyword TEXT,
  category TEXT DEFAULT NULL,
  max_price_paise BIGINT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_clean_name TEXT;
  v_clean_keyword TEXT;
  v_clean_category TEXT;
  v_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT is_eligible_user() THEN RAISE EXCEPTION 'not_eligible'; END IF;

  v_clean_name := btrim(name);
  v_clean_keyword := btrim(keyword);

  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'invalid_name_length';
  END IF;

  IF char_length(v_clean_keyword) < 2 OR char_length(v_clean_keyword) > 100 THEN
    RAISE EXCEPTION 'invalid_keyword_length';
  END IF;

  IF category IS NOT NULL THEN
    v_clean_category := btrim(category);
    IF v_clean_category NOT IN ('cycle', 'calculator', 'books', 'electronics', 'other') THEN
      RAISE EXCEPTION 'invalid_category';
    END IF;
  ELSE
    v_clean_category := NULL;
  END IF;

  IF max_price_paise IS NOT NULL AND max_price_paise <= 0 THEN
    RAISE EXCEPTION 'invalid_max_price';
  END IF;

  INSERT INTO saved_searches (
    user_id,
    name,
    keyword,
    category,
    max_price_paise
  ) VALUES (
    v_actor,
    v_clean_name,
    v_clean_keyword,
    v_clean_category,
    max_price_paise
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION create_saved_search(TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_saved_search(TEXT, TEXT, TEXT, BIGINT) TO authenticated;

-- Function: delete_saved_search
CREATE OR REPLACE FUNCTION delete_saved_search(
  saved_search_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  DELETE FROM saved_searches
  WHERE id = saved_search_id AND user_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'saved_search_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION delete_saved_search(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_saved_search(UUID) TO authenticated;

-- Function: toggle_saved_search
CREATE OR REPLACE FUNCTION toggle_saved_search(
  saved_search_id UUID,
  is_active BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  UPDATE saved_searches
  SET is_active = toggle_saved_search.is_active,
      updated_at = clock_timestamp()
  WHERE id = saved_search_id AND user_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'saved_search_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION toggle_saved_search(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION toggle_saved_search(UUID, BOOLEAN) TO authenticated;


-- ------------------------------------------------------------------------------
-- 0015_saved_search_matching.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_saved_searches_for_auction(
  p_auction_id UUID
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_auction RECORD;
  r RECORD;
  v_count INT := 0;
  v_short_title TEXT;
BEGIN
  SELECT id, seller_id, title, description, category, starting_price_paise, status
  INTO v_auction
  FROM auctions
  WHERE id = p_auction_id;

  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_auction.status <> 'active' THEN RETURN 0; END IF;

  v_short_title := left(v_auction.title, 50);

  FOR r IN
    SELECT s.user_id, s.name, s.keyword
    FROM saved_searches s
    WHERE s.is_active = TRUE
      AND s.user_id <> v_auction.seller_id
      AND (s.category IS NULL OR s.category = v_auction.category)
      AND (s.max_price_paise IS NULL OR v_auction.starting_price_paise <= s.max_price_paise)
      AND (
        v_auction.title ILIKE ('%' || s.keyword || '%')
        OR v_auction.description ILIKE ('%' || s.keyword || '%')
      )
    ORDER BY s.created_at ASC
    LIMIT 500
  LOOP
    INSERT INTO notifications (
      recipient_id,
      type,
      auction_id,
      message
    ) VALUES (
      r.user_id,
      'saved_search_match',
      v_auction.id,
      'Item matching your alert "' || r.name || '" was listed: ' || v_short_title
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION match_saved_searches_for_auction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_saved_searches_for_auction(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION trg_auction_saved_search_matcher()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status <> 'active')) THEN
    PERFORM match_saved_searches_for_auction(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_saved_searches ON auctions;
CREATE TRIGGER trg_match_saved_searches
  AFTER INSERT OR UPDATE OF status ON auctions
  FOR EACH ROW EXECUTE FUNCTION trg_auction_saved_search_matcher();
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
