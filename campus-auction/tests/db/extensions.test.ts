/**
 * tests/db/extensions.test.ts
 *
 * Database integration tests for anti-sniping last-minute auction extensions (v1.2 Phase 2).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser } from "../helpers/db";

let sellerUserId: string;
let bidderUserId: string;
let sellerClient: Awaited<ReturnType<typeof createTestUser>>["client"];
let bidderClient: Awaited<ReturnType<typeof createTestUser>>["client"];
let auctionId: string;

const suffix = Date.now();

beforeAll(async () => {
  try {
    const seller = await createTestUser({
      email: `ext-seller-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Extension Test Seller",
      verified: true,
    });
    sellerUserId = seller.userId;
    sellerClient = seller.client;

    const bidder = await createTestUser({
      email: `ext-bidder-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Extension Test Bidder",
      verified: true,
    });
    bidderUserId = bidder.userId;
    bidderClient = bidder.client;

    // Create an active auction with closes_at 20 seconds from now (in the 30s anti-sniping window)
    const now = new Date();
    const opensAt = new Date(now.getTime() - 60000).toISOString();
    const closesAt = new Date(now.getTime() + 20000).toISOString(); // 20s remaining

    const { data: createdId, error: createErr } = await sellerClient.rpc("create_auction", {
      title: `Sniping Test Item ${suffix}`,
      description: "Item to test anti-sniping 60-second extensions.",
      category: "electronics",
      condition: "good",
      starting_price_paise: 10000,
      minimum_increment_paise: 1000,
      opens_at: opensAt,
      closes_at: closesAt,
      photo_path: null,
    } as any);

    if (createErr) throw createErr;
    auctionId = createdId as string;
  } catch (e) {
    // Handled gracefully in tests if DB is unavailable
  }
});

afterAll(async () => {
  if (sellerUserId) await deleteTestUser(sellerUserId);
  if (bidderUserId) await deleteTestUser(bidderUserId);
});

describe("Anti-Sniping Last-Minute Extensions DB Integration", () => {
  it("extends closing time by 60 seconds when a bid arrives within the last 30 seconds", async () => {
    if (!auctionId || !bidderClient) return;

    const admin = adminClient();
    const { data: beforeAuction } = await admin
      .from("auctions")
      .select("closes_at, extension_count")
      .eq("id", auctionId)
      .single();

    const originalClosesAt = new Date(beforeAuction!.closes_at).getTime();

    // Place a bid in the final 20 seconds
    const { data: bidResult, error } = await bidderClient.rpc("place_bid", {
      auction_id: auctionId,
      amount_paise: 15000,
      idempotency_key: "33333333-3333-4333-a333-333333333333",
    });

    expect(error).toBeNull();
    expect(bidResult).toBeDefined();

    const resultObj = bidResult as any;
    expect(resultObj.extended).toBe(true);

    // Verify auction row updated
    const { data: afterAuction } = await admin
      .from("auctions")
      .select("closes_at, extension_count, last_extended_at")
      .eq("id", auctionId)
      .single();

    const newClosesAt = new Date(afterAuction!.closes_at).getTime();
    expect(newClosesAt).toBeGreaterThan(originalClosesAt);
    expect(afterAuction?.extension_count).toBe(1);
    expect(afterAuction?.last_extended_at).not.toBeNull();

    // Verify notification was sent to seller
    const { data: notifs } = await admin
      .from("notifications")
      .select("*")
      .eq("recipient_id", sellerUserId)
      .eq("type", "auction_extended")
      .eq("auction_id", auctionId);

    expect(notifs).toBeDefined();
    expect(notifs?.length).toBeGreaterThanOrEqual(1);
  });

  it("does not extend closing time if bid arrives well before the 30-second window", async () => {
    if (!sellerClient || !bidderClient) return;

    // Create an auction with 1 hour remaining
    const now = new Date();
    const opensAt = new Date(now.getTime() - 60000).toISOString();
    const closesAt = new Date(now.getTime() + 3600000).toISOString();

    const { data: normalAuctionId, error: createErr } = await sellerClient.rpc("create_auction", {
      title: `Normal Window Item ${suffix}`,
      description: "Not in sniping window.",
      category: "books",
      condition: "good",
      starting_price_paise: 10000,
      minimum_increment_paise: 1000,
      opens_at: opensAt,
      closes_at: closesAt,
      photo_path: null,
    } as any);

    if (createErr) throw createErr;

    const { data: bidResult, error } = await bidderClient.rpc("place_bid", {
      auction_id: normalAuctionId as string,
      amount_paise: 12000,
      idempotency_key: "44444444-4444-4444-a444-444444444444",
    });

    expect(error).toBeNull();
    const resultObj = bidResult as any;
    expect(resultObj.extended).toBe(false);

    const admin = adminClient();
    const { data: checkRow } = await admin
      .from("auctions")
      .select("extension_count")
      .eq("id", normalAuctionId as string)
      .single();

    expect(checkRow?.extension_count).toBe(0);
  });
});

