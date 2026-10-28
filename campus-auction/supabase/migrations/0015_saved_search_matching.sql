-- Migration 0015: Saved search matching and notification dispatch
-- When an auction is published (active), matches active saved searches and sends saved_search_match notifications.
-- Includes a fan-out cap of 500 notifications per auction.

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
  -- Read auction
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

-- Trigger to match automatically on auction creation or activation
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

