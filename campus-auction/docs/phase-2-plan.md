# Phase-2 Implementation Plan — Campus Auction

This document specifies the architecture, migrations, database functions, server actions, UI routes, test suites, and commit steps for the Phase-2 feature releases of the Campus Auction platform.

---

## 1. Architectural Decisions & Gated Approvals

Before any feature code is implemented, the following six architectural decisions must be approved by the project lead.

### D1: Maximum Bid Visibility & Automatic Bidding
* **Context**: Automatic bidding requires storing a student's maximum willingness-to-pay.
* **Option A (Recommended)**: **Private maximums**. Each student's maximum is stored in a private `auto_bids` table protected with Row-Level Security (RLS) so that only the owner can read their own maximum. All public views and API responses expose only the currently effective leading price.
* **Option B**: Public maximums. All maximum bids are visible to every student.
* **Default Recommendation**: **Private maximums**. Blocks sniping, preserves fair market valuation, and prevents price manipulation while adhering strictly to D-013.

### D2: Anti-Sniping Last-Minute Extension Cap
* **Context**: When a bid is placed in the final 30 seconds of an auction, the deadline is extended by 60 seconds (`new_closes_at = clock_timestamp() + 60s`). Without an upper bound, a bidding war could theoretically extend indefinitely.
* **Option A (Recommended)**: **Cap of 20 extensions per auction** (maximum total extension window: 20 minutes).
* **Option B**: Unlimited extensions.
* **Option C**: Fixed 10-extension cap.
* **Default Recommendation**: **20 extensions per auction**. Provides ample time for authentic manual bidders across campus networks while guaranteeing deterministic closure.

### D3: Question Eligibility on Listings
* **Context**: Buyers need to ask questions about item conditions (e.g. cycle brakes, calculator display, textbook edition) without spamming the seller.
* **Option A (Recommended)**: **Verified buyers only, excluding the seller**. Limited to at most 5 questions per auction per student, with a durable rate limiter of at most 1 question per minute.
* **Option B**: Any signed-in user, including the seller.
* **Default Recommendation**: **Verified buyers only, excluding the seller**. Protects listing clarity, prevents self-promotional spam, and stops harassment.

### D4: Alert & Notification Delivery
* **Context**: Students need to be notified when items matching their saved searches are listed, when questions are answered, and when outbid.
* **Option A (Recommended)**: **In-app notifications + Native Web Notification pop-ups** (active tab and background tab sync).
* **Option B**: External email / SMS notifications.
* **Default Recommendation**: **In-app + Browser Web Notifications**. Zero external vendor lock-in, zero messaging costs, fully self-contained within Supabase Realtime and the native Web Notifications API.

### D5: AI Assistant Scope & Safety Guardrails
* **Context**: Students want conversational search and automated bidding assistance ("find a cycle under ₹2,000 and bid for me").
* **Option A (Recommended)**: **Two-phase deployment: Read-only first (v2.1), followed by human-confirmed assisted bidding (v2.2)**.
* **Option B**: Full autonomous bidding by LLM without confirmation.
* **Default Recommendation**: **Read-only search first, human-confirmed assisted bidding second**. The assistant strictly emits structured filter proposals. It never executes a financial bid autonomously without explicit student confirmation on a dedicated proposal card.

### D6: Notification Type Constraint Migration Strategy
* **Context**: Adding new notification event types (`question_asked`, `question_answered`, `saved_search_match`, `auction_extended`, etc.).
* **Option A (Recommended)**: **Added through dedicated migration `0012_notification_types.sql`** that safely drops and recreates `notifications_type_check` with the complete set of enum types.
* **Option B**: Unconstrained string column.
* **Default Recommendation**: **Migration-managed CHECK constraint**. Maintains data integrity in PostgreSQL while accommodating Phase-2 event types.

---

## 2. Feature Specifications & Technical Breakdown

```
Phase 2 Roadmap:
Stage 1: docs/phase-2-plan.md (Gated Decision Review)
Stage 2: v1.1.0 — Questions (12.3) & Saved-Search Alerts (12.4)
Stage 3: v1.2.0 — Last-Minute Auction Extensions (12.5)
Stage 4: v2.0.0 — Automatic Proxy Bidding (12.6)
Stage 5: v2.1.0 — AI Assistant: Structured Search (Read-Only)
Stage 6: v2.2.0 — AI Assistant: Human-Confirmed Assisted Bidding
```

---

### Feature 1: Questions Before Bidding (v1.1)

#### 1. Database Schema (`0013_auction_questions.sql`)
```sql
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

CREATE INDEX idx_questions_auction_visible 
ON auction_questions(auction_id, created_at ASC) 
WHERE is_hidden = FALSE;
```

#### 2. PostgreSQL Functions
* `ask_question(p_auction_id UUID, p_question TEXT)`:
  - Guard 1: `auth.uid()` is authenticated and eligible.
  - Guard 2: Asker is not the auction seller (`v_auction.seller_id <> v_actor`).
  - Guard 3: Auction status is `active`.
  - Guard 4: Rate limit: at most 1 question per minute per student.
  - Guard 5: Quota: at most 5 questions per student per auction.
  - Emits notification `question_asked` to `v_auction.seller_id`.
* `answer_question(p_question_id UUID, p_answer TEXT)`:
  - Guard 1: `auth.uid()` is the seller of the auction.
  - Guard 2: Question is not hidden and not already answered.
  - Updates `answer` and `answered_at = clock_timestamp()`.
  - Emits notification `question_answered` to `v_question.asker_id`.
* `hide_question(p_question_id UUID, p_reason TEXT)`:
  - Allowed only for the auction seller or admin.
  - Sets `is_hidden = TRUE`, `hidden_reason = p_reason`.

#### 3. Server Actions & UI
* Actions: `askAuctionQuestion(auctionId, text)`, `answerAuctionQuestion(questionId, text)`, `hideAuctionQuestion(questionId, reason)`.
* UI:
  - Buyer View: Collapsible Q&A section on `/auctions/[id]` displaying public answered questions and an "Ask Seller a Question" form.
  - Seller View: Dedicated Q&A management drawer on `/auctions/[id]` with answer input and spam hide control.

#### 4. Test Suite (`tests/db/questions.test.ts`)
* Verified buyer can ask valid question; seller cannot ask on own auction.
* 1-per-minute rate limit and 5-per-auction quota strictly enforced.
* Only the seller can answer.
* Hidden questions excluded from public view.
* Asking/answering questions never alters `current_price_paise`, status, or `closes_at`.

---

### Feature 2: Saved Searches & Push Alerts (v1.1)

#### 1. Database Schema (`0014_saved_searches.sql`)
```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  query TEXT NULL CHECK (query IS NULL OR char_length(btrim(query)) <= 100),
  category TEXT NULL CHECK (category IS NULL OR category IN ('cycle', 'calculator', 'books', 'electronics', 'other')),
  condition TEXT NULL CHECK (condition IS NULL OR condition IN ('new', 'like_new', 'good', 'fair', 'for_parts')),
  max_price_paise BIGINT NULL CHECK (max_price_paise IS NULL OR max_price_paise > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_saved_searches_active ON saved_searches(is_active) WHERE is_active = TRUE;
```

#### 2. Matching Function (`0015_saved_search_matching.sql`)
* Update `create_auction`:
  - Under same transaction, scans active saved searches matching `category`, `condition`, `max_price_paise`, and keyword `query`.
  - Capped at **500 searches per listing** to guarantee deterministic bounded execution.
  - Overflows are recorded in `saved_search_overflow` and processed asynchronously by `process_expired`.
  - Inserts deduplicated notification `saved_search_match` to matching students.

#### 3. UI & Tests (`tests/db/saved-searches.test.ts`)
* Route `/saved-searches`: list, create, toggle, and delete saved search alerts.
* Tests verify matching by keyword, category, condition, price; max 10 active searches per user; 500-search bounded cap; and deduplication.

---

### Feature 3: Anti-Sniping Last-Minute Extensions (v1.2)

#### 1. Database Schema (`0016_auction_extensions.sql`)
```sql
CREATE TABLE auction_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  old_closes_at TIMESTAMPTZ NOT NULL,
  new_closes_at TIMESTAMPTZ NOT NULL,
  extension_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE auctions ADD COLUMN extension_count INT NOT NULL DEFAULT 0;
```

#### 2. Modified `place_bid` (`0017_place_bid_extension.sql`)
* Under row lock (`SELECT * FROM auctions WHERE id = ... FOR UPDATE`):
* Reads `v_now := clock_timestamp();` post-lock.
* If `v_now >= v_auction.closes_at`: rejects with `auction_closed`.
* After bid insertion, checks if extension is triggered:
  ```sql
  IF (v_auction.closes_at - v_now) <= INTERVAL '30 seconds' 
     AND v_auction.extension_count < 20 THEN
    
    v_old_closes_at := v_auction.closes_at;
    v_new_closes_at := v_now + INTERVAL '60 seconds';

    UPDATE auctions 
    SET closes_at = v_new_closes_at,
        extension_count = extension_count + 1
    WHERE id = v_auction.id;

    INSERT INTO auction_extensions (
      auction_id, bid_id, old_closes_at, new_closes_at, extension_number
    ) VALUES (
      v_auction.id, v_new_bid_id, v_old_closes_at, v_new_closes_at, v_auction.extension_count + 1
    );

    -- Notify all active bidders of deadline extension
    INSERT INTO notifications (recipient_id, type, auction_id, message)
    SELECT DISTINCT bidder_id, 'auction_extended', v_auction.id,
           format('Bidding extended by 60 seconds on "%s".', v_auction.title)
    FROM bids WHERE auction_id = v_auction.id AND bidder_id <> v_actor
    ON CONFLICT DO NOTHING;
  END IF;
  ```
* Strict Invariant: `close_auction` and `process_expired` read `closes_at` strictly **after** row locking. A bid placed at or after `closes_at` is always rejected.

#### 3. Test Suite (`tests/db/extensions.test.ts`)
* Bid placed at $T - 40\text{s}$ does not extend.
* Bid placed at $T - 15\text{s}$ extends closing time by 60s from clock.
* Multiple rapid bids extend up to cap of 20 and then reject further extension.
* Concurrent race: extending bid vs. closure worker racing on the same locked row.

---

### Feature 4: Automatic Proxy Bidding (v2.0)

#### 1. Proxy Resolution Algorithm
When student $B$ registers a maximum $M_B$ on auction $A$:
1. **Locking**: Row lock auction $A$ with `FOR UPDATE`.
2. **Current State**: Current leading price $P$, current leader $L$ (with maximum $M_L$), minimum increment $I$.
3. **Validation**:
   - $M_B \ge$ Minimum required bid ($P + I$, or starting price $S$ if no bids).
   - $B \ne$ Seller of $A$.
4. **Resolution Matrix**:
   - **Case 1: No existing auto-bid or $B$ is outbidding a manual bid**:
     - If $B$'s maximum is higher than current price: price moves to minimum needed to lead ($\max(S, P + I)$). $B$ becomes leader.
   - **Case 2: Existing auto-bid leader $L$ with maximum $M_L$**:
     - **Subcase 2a: $M_B > M_L$**:
       - New leader is $B$.
       - Price moves to $\min(M_B, M_L + I)$.
       - $L$ is outbid.
     - **Subcase 2b: $M_B < M_L$**:
       - Leader remains $L$.
       - Price moves to $\min(M_L, M_B + I)$.
       - $B$ is immediately outbid by proxy.
     - **Subcase 2c: $M_B = M_L$ (Tie)**:
       - Earlier maximum takes precedence: leader remains $L$.
       - Price moves to $M_L$.
       - $B$ is informed their bid was matched by an earlier bidder.
5. **Privacy Enforcement**:
   - `auto_bids.max_amount_paise` is protected by RLS: `SELECT USING (auth.uid() = bidder_id)`.
   - Notifications and public bid history record only the actual effective bid amount, never the maximum.

#### 2. Database Schema (`0018_auto_bids.sql` & `0019_place_bid_proxy.sql`)
```sql
CREATE TABLE auto_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_amount_paise BIGINT NOT NULL CHECK (max_amount_paise > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(auction_id, bidder_id)
);

ALTER TABLE auto_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_bids_owner_all ON auto_bids 
FOR ALL TO authenticated 
USING (auth.uid() = bidder_id) 
WITH CHECK (auth.uid() = bidder_id);
```

---

### Feature 5: AI Assistant — Read-Only Natural Language Search (v2.1)

#### 1. Architecture & Security Isolation
* Route: `/buyer/assistant`
* Student prompt: *"Find a scientific calculator in good condition under ₹500"*
* **Zero Service-Role Access**: The assistant invokes search purely through the student's authenticated session.
* **Structured Output Schema**:
  ```ts
  const AssistantFilterSchema = z.object({
    searchQuery: z.string().max(80).optional(),
    category: z.enum(["cycle", "calculator", "books", "electronics", "other"]).optional(),
    condition: z.enum(["new", "like_new", "good", "fair", "for_parts"]).optional(),
    maxPriceRupees: z.number().positive().max(100000).optional(),
    clarifyingQuestion: z.string().max(200).optional(),
  });
  ```
* **Prompt Injection Protection**: Assistant instructions are isolated via system prompts. Injected text in listing descriptions is ignored as listings are passed as structured data arrays, not executable instructions.
* **Rate Limits**: 10 assistant requests per minute per user stored in Redis / Postgres counter.

---

### Feature 6: AI Assistant — Assisted Bidding (v2.2)

#### 1. Proposal Schema (`0020_assistant_proposals.sql`)
```sql
CREATE TABLE assistant_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('bid', 'auto_bid')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  user_stated_limit_paise BIGINT NOT NULL CHECK (user_stated_limit_paise >= amount_paise),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE assistant_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY assistant_proposals_owner_read ON assistant_proposals
FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

#### 2. Human Confirmation Enforcement
* Assistant can only insert rows with `status = 'pending'`.
* Function `confirm_proposal(proposal_id UUID)`:
  - Caller must be `auth.uid() = user_id`.
  - Proposal must be `pending` and `clock_timestamp() < expires_at`.
  - Under row lock, updates proposal status to `confirmed`.
  - Dispatches call to `place_bid` or sets `auto_bids`.
  - A proposal can be confirmed exactly once.
* Function `decline_proposal(proposal_id UUID)` marks status as `declined` with zero bidding side effects.

---

## 3. Commit Sequence & Release Milestones

| Stage | Milestone | Version | Commit Conventional Message | Gated Dependency |
|---|---|---|---|---|
| **Stage 1** | Phase-2 Plan | - | `docs(plan): add phase-2 plan and architectural decisions` | Current turn |
| **Stage 2** | Questions & Q&A | v1.1.0 | `feat(questions): add auction Q&A table, limits, and seller controls` | Approved D3, D6 |
| **Stage 2** | Saved Searches | v1.1.0 | `feat(alerts): add saved searches, 500-cap matching, and alerts` | Approved D4 |
| **Stage 3** | Anti-Sniping Extensions | v1.2.0 | `feat(extensions): implement last-minute anti-sniping extension cap` | Approved D2 |
| **Stage 4** | Auto Proxy Bidding | v2.0.0 | `feat(proxy): implement private maximums and atomic proxy resolution` | Approved D1 |
| **Stage 5** | Read-Only AI Assistant | v2.1.0 | `feat(assistant): add read-only natural language search assistant` | Approved D5, LLM Key |
| **Stage 6** | Assisted Bidding | v2.2.0 | `feat(proposals): add human-confirmed assisted bidding proposals` | Approved D5 |

---

## 4. Verification Checklists & Invariants

* [ ] Migrations `0001` through `0011` remain untouched and immutable.
* [ ] New migrations start from `0012` upward.
* [ ] All functions retain `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, and explicit `GRANT TO authenticated`.
* [ ] All actors derived solely from `auth.uid()`, never accepted as caller parameters.
* [ ] Every bid, extension, proxy, and closure locks the auction row first, and evaluates clock only after acquiring the lock.
* [ ] All money stored as integer paise.
* [ ] Full regression suite passes before every release merge.

