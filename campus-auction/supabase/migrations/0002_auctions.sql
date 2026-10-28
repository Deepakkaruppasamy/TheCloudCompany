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
