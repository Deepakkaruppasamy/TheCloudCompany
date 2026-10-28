-- Migration 0013: Auction questions before bidding
-- Allows verified buyers to ask questions on active listings, sellers to answer, and operators/sellers to moderate.

CREATE TABLE auction_questions (
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
CREATE INDEX idx_auction_questions_auction_created ON auction_questions(auction_id, created_at ASC);
CREATE INDEX idx_auction_questions_asker_created ON auction_questions(asker_id, created_at DESC);

-- Row Level Security
ALTER TABLE auction_questions ENABLE ROW LEVEL SECURITY;

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
