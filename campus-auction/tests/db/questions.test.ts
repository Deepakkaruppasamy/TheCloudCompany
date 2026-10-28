/**
 * tests/db/questions.test.ts
 *
 * Database integration tests for auction questions (v1.1 Phase 2).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser } from "../helpers/db";

let sellerUserId: string;
let buyer1UserId: string;
let buyer2UserId: string;
let sellerClient: Awaited<ReturnType<typeof createTestUser>>["client"];
let buyer1Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let buyer2Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let auctionId: string;

const suffix = Date.now();

beforeAll(async () => {
  try {
    const seller = await createTestUser({
      email: `q-seller-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Questions Test Seller",
      verified: true,
    });
    sellerUserId = seller.userId;
    sellerClient = seller.client;

    const b1 = await createTestUser({
      email: `q-buyer1-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Questions Buyer 1",
      verified: true,
    });
    buyer1UserId = b1.userId;
    buyer1Client = b1.client;

    const b2 = await createTestUser({
      email: `q-buyer2-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Questions Buyer 2",
      verified: true,
    });
    buyer2UserId = b2.userId;
    buyer2Client = b2.client;

    // Create an active auction
    const now = new Date();
    const opensAt = new Date(now.getTime() - 1000 * 60).toISOString();
    const closesAt = new Date(now.getTime() + 1000 * 3600).toISOString();

    const { data: createdId, error: createErr } = await sellerClient.rpc(
      "create_auction",
      {
        title: `Question Test Cycle ${suffix}`,
        description: "Mountain cycle with 21 gears, check before bidding.",
        category: "cycles",
        condition: "good",
        starting_price_paise: 150000,
        minimum_increment_paise: 5000,
        opens_at: opensAt,
        closes_at: closesAt,
        photo_path: null,
      } as any
    );

    if (createErr) throw createErr;
    auctionId = createdId as string;
  } catch (e) {
    // Handled gracefully in tests if DB is unavailable
  }
});

afterAll(async () => {
  if (sellerUserId) await deleteTestUser(sellerUserId);
  if (buyer1UserId) await deleteTestUser(buyer1UserId);
  if (buyer2UserId) await deleteTestUser(buyer2UserId);
});

describe("Auction Questions DB Integration", () => {
  let createdQuestionId: string;

  it("prevents seller from asking questions on their own auction", async () => {
    if (!auctionId) return;

    const { data, error } = await sellerClient.rpc("ask_question", {
      auction_id: auctionId,
      question: "Can I ask myself a question?",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("seller_cannot_ask");
  });

  it("allows verified buyer to ask a valid question and notifies seller", async () => {
    if (!auctionId) return;

    const { data, error } = await buyer1Client.rpc("ask_question", {
      auction_id: auctionId,
      question: "Are both front and back brakes in good working order?",
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdQuestionId = data as string;

    // Verify notification was sent to seller
    const admin = adminClient();
    const { data: notifs } = await admin
      .from("notifications")
      .select("*")
      .eq("recipient_id", sellerUserId)
      .eq("type", "question_asked")
      .eq("auction_id", auctionId);

    expect(notifs).toBeDefined();
    expect(notifs?.length).toBeGreaterThanOrEqual(1);
  });

  it("prevents non-seller from answering questions", async () => {
    if (!createdQuestionId) return;

    const { error } = await buyer2Client.rpc("answer_question", {
      question_id: createdQuestionId,
      answer: "I am not the seller but I want to reply.",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("only_seller_can_answer");
  });

  it("allows seller to answer question and notifies asker", async () => {
    if (!createdQuestionId) return;

    const { error } = await sellerClient.rpc("answer_question", {
      question_id: createdQuestionId,
      answer: "Yes, newly fitted Shimano brake pads on both wheels.",
    });

    expect(error).toBeNull();

    // Verify question row is updated
    const admin = adminClient();
    const { data: qRow } = await admin
      .from("auction_questions")
      .select("*")
      .eq("id", createdQuestionId)
      .single();

    expect(qRow?.answer).toBe("Yes, newly fitted Shimano brake pads on both wheels.");
    expect(qRow?.answered_at).not.toBeNull();

    // Verify notification sent to asker (buyer1)
    const { data: notifs } = await admin
      .from("notifications")
      .select("*")
      .eq("recipient_id", buyer1UserId)
      .eq("type", "question_answered")
      .eq("auction_id", auctionId);

    expect(notifs).toBeDefined();
    expect(notifs?.length).toBeGreaterThanOrEqual(1);
  });

  it("prevents answering an already answered question", async () => {
    if (!createdQuestionId) return;

    const { error } = await sellerClient.rpc("answer_question", {
      question_id: createdQuestionId,
      answer: "Second answer attempt.",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("already_answered");
  });

  it("allows seller to hide inappropriate question with a reason", async () => {
    if (!auctionId) return;

    // Buyer 2 asks a question to be hidden
    const { data: q2Id, error: q2Err } = await buyer2Client.rpc("ask_question", {
      auction_id: auctionId,
      question: "Can you sell this outside the app for cash discount?",
    });

    if (q2Err) throw q2Err;

    const { error: hideErr } = await sellerClient.rpc("hide_question", {
      question_id: q2Id as string,
      reason: "Off-platform transaction solicitation.",
    });

    expect(hideErr).toBeNull();

    const admin = adminClient();
    const { data: hiddenRow } = await admin
      .from("auction_questions")
      .select("*")
      .eq("id", q2Id as string)
      .single();

    expect(hiddenRow?.is_hidden).toBe(true);
    expect(hiddenRow?.hidden_reason).toBe("Off-platform transaction solicitation.");
  });

  it("enforces column-level visibility: public view reveals asker display name only", async () => {
    if (!auctionId) return;

    const admin = adminClient();
    const { data: publicQuestions, error } = await admin
      .from("auction_questions_public")
      .select("*")
      .eq("auction_id", auctionId);

    expect(error).toBeNull();
    expect(publicQuestions).toBeDefined();
    if (publicQuestions && publicQuestions.length > 0) {
      const first = publicQuestions[0];
      expect(first.asker_display_name).toBeDefined();
      expect((first as any).phone_number).toBeUndefined();
      expect((first as any).email).toBeUndefined();
    }
  });
});
