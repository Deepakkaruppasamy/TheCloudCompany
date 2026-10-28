-- Migration 0014: Saved searches and buyer alerts
-- Allows buyers to save up to 10 active searches to get notified when matching items are listed.

CREATE TABLE saved_searches (
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
CREATE INDEX idx_saved_searches_user_active ON saved_searches(user_id, is_active);
CREATE INDEX idx_saved_searches_active_category ON saved_searches(category) WHERE is_active = TRUE;

-- Row Level Security
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

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
