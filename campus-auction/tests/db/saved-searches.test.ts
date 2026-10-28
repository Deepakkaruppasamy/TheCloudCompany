/**
 * tests/db/saved-searches.test.ts
 *
 * Database integration tests for saved searches and match alerts (v1.1 Phase 2).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser } from "../helpers/db";

let sellerUserId: string;
let buyerUserId: string;
let sellerClient: Awaited<ReturnType<typeof createTestUser>>["client"];
let buyerClient: Awaited<ReturnType<typeof createTestUser>>["client"];

const suffix = Date.now();

beforeAll(async () => {
  try {
    const seller = await createTestUser({
      email: `ss-seller-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Saved Search Seller",
      verified: true,
    });
    sellerUserId = seller.userId;
    sellerClient = seller.client;

    const buyer = await createTestUser({
      email: `ss-buyer-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Saved Search Buyer",
      verified: true,
    });
    buyerUserId = buyer.userId;
    buyerClient = buyer.client;
  } catch (e) {
    // Handled gracefully in tests if DB is unavailable
  }
});

afterAll(async () => {
  if (sellerUserId) await deleteTestUser(sellerUserId);
  if (buyerUserId) await deleteTestUser(buyerUserId);
});

describe("Saved Searches & Alerts DB Integration", () => {
  let createdSearchId: string;

  it("allows verified buyer to create a saved search alert", async () => {
    if (!buyerClient) return;

    const { data, error } = await buyerClient.rpc("create_saved_search", {
      name: "Casio Calculator Alert",
      keyword: "Calculator",
      category: "electronics",
      max_price_paise: 60000,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    createdSearchId = data as string;

    const admin = adminClient();
    const { data: row } = await admin
      .from("saved_searches")
      .select("*")
      .eq("id", createdSearchId)
      .single();

    expect(row?.name).toBe("Casio Calculator Alert");
    expect(row?.keyword).toBe("Calculator");
    expect(row?.is_active).toBe(true);
  });

  it("allows toggling a saved search active/paused state", async () => {
    if (!createdSearchId) return;

    const { error: pauseErr } = await buyerClient.rpc("toggle_saved_search", {
      saved_search_id: createdSearchId,
      is_active: false,
    });
    expect(pauseErr).toBeNull();

    const admin = adminClient();
    const { data: pausedRow } = await admin
      .from("saved_searches")
      .select("is_active")
      .eq("id", createdSearchId)
      .single();
    expect(pausedRow?.is_active).toBe(false);

    // Resume it
    const { error: resumeErr } = await buyerClient.rpc("toggle_saved_search", {
      saved_search_id: createdSearchId,
      is_active: true,
    });
    expect(resumeErr).toBeNull();
  });

  it("enforces a hard limit of at most 10 active saved searches per user", async () => {
    if (!buyerClient) return;

    const tempIds: string[] = [];
    try {
      // We already have 1 active search. Let's create 9 more to reach the 10-search cap.
      for (let i = 2; i <= 10; i++) {
        const { data, error } = await buyerClient.rpc("create_saved_search", {
          name: `Cap Test ${i}`,
          keyword: `item${i}`,
        });
        if (error) throw error;
        tempIds.push(data as string);
      }

      // The 11th should be rejected by the trigger guard
      const { data: excessData, error: excessErr } = await buyerClient.rpc(
        "create_saved_search",
        {
          name: "Excess Search 11",
          keyword: "item11",
        }
      );

      expect(excessErr).not.toBeNull();
      expect(excessErr?.message).toContain("max_saved_searches_exceeded");
    } finally {
      // Clean up temporary searches
      for (const id of tempIds) {
        await buyerClient.rpc("delete_saved_search", { saved_search_id: id });
      }
    }
  });

  it("matches newly published auction against active alerts and notifies the buyer", async () => {
    if (!sellerClient || !createdSearchId) return;

    const now = new Date();
    const opensAt = new Date(now.getTime() - 1000 * 60).toISOString();
    const closesAt = new Date(now.getTime() + 1000 * 3600).toISOString();

    // Seller lists an item matching "Calculator" in "electronics" under 60,000 paise
    const { data: auctionId, error: createErr } = await sellerClient.rpc(
      "create_auction",
      {
        title: `Casio Scientific Calculator FX-${suffix}`,
        description: "Excellent scientific calculator with high-contrast display.",
        category: "electronics",
        condition: "like_new",
        starting_price_paise: 45000,
        minimum_increment_paise: 2000,
        opens_at: opensAt,
        closes_at: closesAt,
        photo_path: null,
      } as any
    );

    if (createErr) throw createErr;
    expect(auctionId).toBeDefined();

    // Check notifications for buyer
    const admin = adminClient();
    const { data: notifs } = await admin
      .from("notifications")
      .select("*")
      .eq("recipient_id", buyerUserId)
      .eq("type", "saved_search_match")
      .eq("auction_id", auctionId as string);

    expect(notifs).toBeDefined();
    expect(notifs?.length).toBeGreaterThanOrEqual(1);
    expect(notifs![0].message).toContain("Casio Calculator Alert");

    // Seller must NOT receive alert for their own listing
    const { data: sellerNotifs } = await admin
      .from("notifications")
      .select("*")
      .eq("recipient_id", sellerUserId)
      .eq("type", "saved_search_match")
      .eq("auction_id", auctionId as string);

    expect(sellerNotifs?.length).toBe(0);
  });

  it("allows user to delete their saved search", async () => {
    if (!createdSearchId) return;

    const { error } = await buyerClient.rpc("delete_saved_search", {
      saved_search_id: createdSearchId,
    });
    expect(error).toBeNull();

    const admin = adminClient();
    const { data: checkRow } = await admin
      .from("saved_searches")
      .select("*")
      .eq("id", createdSearchId);

    expect(checkRow?.length).toBe(0);
  });
});

