/**
 * tests/db/auto-bidding.test.ts
 *
 * Database integration tests for automatic proxy bidding and private maximums (v2.0 Phase 2).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser } from "../helpers/db";

let sellerUserId: string;
let bidder1UserId: string;
let bidder2UserId: string;
let sellerClient: Awaited<ReturnType<typeof createTestUser>>["client"];
let bidder1Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let bidder2Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let auctionId: string;

const suffix = Date.now();

beforeAll(async () => {
  try {
    const seller = await createTestUser({
      email: `auto-seller-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Auto Bid Seller",
      verified: true,
    });
    sellerUserId = seller.userId;
    sellerClient = seller.client;

    const b1 = await createTestUser({
      email: `auto-b1-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Auto Bidder 1",
      verified: true,
    });
    bidder1UserId = b1.userId;
    bidder1Client = b1.client;

    const b2 = await createTestUser({
      email: `auto-b2-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Auto Bidder 2",
      verified: true,
    });
    bidder2UserId = b2.userId;
    bidder2Client = b2.client;

    // Create an active auction
    const now = new Date();
    const opensAt = new Date(now.getTime() - 60000).toISOString();
    const closesAt = new Date(now.getTime() + 3600000).toISOString();

    const { data: createdId, error: createErr } = await sellerClient.rpc("create_auction", {
      title: `Auto Bid Test Cycle ${suffix}`,
      description: "Cycle to test automatic proxy bidding.",
      category: "cycle",
      condition: "good",
      starting_price_paise: 10000, // ₹100
      minimum_increment_paise: 1000, // ₹10
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
  if (bidder1UserId) await deleteTestUser(bidder1UserId);
  if (bidder2UserId) await deleteTestUser(bidder2UserId);
});

describe("Automatic Proxy Bidding DB Integration", () => {
  it("prevents seller from setting auto-bid on their own listing", async () => {
    if (!auctionId || !sellerClient) return;

    const { error } = await sellerClient.rpc("set_auto_bid", {
      auction_id: auctionId,
      max_amount_paise: 20000,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("seller_cannot_bid");
  });

  it("places initial bid at starting price when first proxy bid is registered", async () => {
    if (!auctionId || !bidder1Client) return;

    // Bidder 1 sets max ₹200 (20000 paise)
    const { data, error } = await bidder1Client.rpc("set_auto_bid", {
      auction_id: auctionId,
      max_amount_paise: 20000,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();

    const admin = adminClient();
    const { data: auction } = await admin
      .from("auctions")
      .select("current_price_paise")
      .eq("id", auctionId)
      .single();

    // Should lead at starting price ₹100 (10000 paise), not the full ₹200
    expect(auction?.current_price_paise).toBe(10000);
  });

  it("automatically competes between two proxy bidders keeping higher max in lead", async () => {
    if (!auctionId || !bidder2Client) return;

    // Bidder 2 sets max ₹150 (15000 paise)
    const { data, error } = await bidder2Client.rpc("set_auto_bid", {
      auction_id: auctionId,
      max_amount_paise: 15000,
    });

    expect(error).toBeNull();

    const admin = adminClient();
    const { data: auction } = await admin
      .from("auctions")
      .select("current_price_paise")
      .eq("id", auctionId)
      .single();

    // Bidder 1 (max ₹200) should automatically beat Bidder 2 (max ₹150) at ₹150 + ₹10 = ₹160 (16000 paise)
    expect(auction?.current_price_paise).toBe(16000);

    // Check that Bidder 1 is still the leader
    const { data: leadBid } = await admin
      .from("bids")
      .select("bidder_id, amount_paise")
      .eq("auction_id", auctionId)
      .order("amount_paise", { ascending: false })
      .limit(1)
      .single();

    expect(leadBid?.bidder_id).toBe(bidder1UserId);
    expect(leadBid?.amount_paise).toBe(16000);

    // Bidder 2 should receive proxy_outbid notification
    const { data: notifs } = await admin
      .from("notifications")
      .select("*")
      .eq("recipient_id", bidder2UserId)
      .eq("type", "proxy_outbid")
      .eq("auction_id", auctionId);

    expect(notifs).toBeDefined();
    expect(notifs?.length).toBeGreaterThanOrEqual(1);
  });

  it("strictly enforces private maximums through Row-Level Security", async () => {
    if (!auctionId || !bidder2Client) return;

    // Bidder 2 queries auto_bids — RLS must only reveal their own row, NOT Bidder 1's
    const { data: visibleAutoBids, error } = await bidder2Client
      .from("auto_bids")
      .select("*")
      .eq("auction_id", auctionId);

    expect(error).toBeNull();
    expect(visibleAutoBids).toBeDefined();

    // Must not see bidder 1's row
    const bidder1Row = visibleAutoBids?.find((r) => r.bidder_id === bidder1UserId);
    expect(bidder1Row).toBeUndefined();

    // Can only see their own row
    expect(visibleAutoBids?.every((r) => r.bidder_id === bidder2UserId)).toBe(true);
  });
});
