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

GRANT SELECT ON auction_questions TO authenticated;
GRANT SELECT ON auction_questions_public TO authenticated, anon;

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

GRANT ALL ON saved_searches TO authenticated;

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

-- Force Supabase PostgREST API to refresh schema cache immediately
NOTIFY pgrst, 'reload schema';
