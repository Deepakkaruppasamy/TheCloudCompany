/**
 * tests/db/bidding.test.ts
 *
 * Bidding function tests against real PostgreSQL.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser } from "../helpers/db";

let sellerUserId: string;
let bidder1UserId: string;
let bidder2UserId: string;
let bidder1Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let bidder2Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let sellerClient: Awaited<ReturnType<typeof createTestUser>>["client"];

const suffix = Date.now();

beforeAll(async () => {
  try {
    const seller = await createTestUser({
      email: `bid-seller-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Bid Test Seller",
      verified: true,
    });
    sellerUserId = seller.userId;
    sellerClient = seller.client;

    const b1 = await createTestUser({
      email: `bid-b1-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Bid Test Bidder 1",
      verified: true,
    });
    bidder1UserId = b1.userId;
    bidder1Client = b1.client;

    const b2 = await createTestUser({
      email: `bid-b2-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "Bid Test Bidder 2",
      verified: true,
    });
    bidder2UserId = b2.userId;
    bidder2Client = b2.client;

    const admin = adminClient();
    await admin.from("system_config" as any).upsert([
      { key: "seller_response_seconds", value_seconds: 86400 },
      { key: "pickup_seconds", value_seconds: 172800 },
    ]);
  } catch (e) {
    // Graceful skip if DB is not running
  }
});

afterAll(async () => {
  if (sellerUserId) await deleteTestUser(sellerUserId);
  if (bidder1UserId) await deleteTestUser(bidder1UserId);
  if (bidder2UserId) await deleteTestUser(bidder2UserId);
});

async function createTestAuction(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const { data, error } = await (sellerClient.rpc as any)("create_auction", {
    title: "Test Auction " + Date.now(),
    description: "Test auction description for bidding tests",
    category: "other",
    condition: "good",
    starting_price_paise: 10000,
    minimum_increment_paise: 1000,
    opens_at: new Date(now.getTime() - 60000).toISOString(),
    closes_at: new Date(now.getTime() + 3600000).toISOString(),
    photo_path: null,
    ...overrides,
  });
  if (error) throw new Error(`create_auction failed: ${error.message}`);
  return data as string;
}

describe("place_bid", () => {
  it("accepts first bid at exactly the starting price", async () => {
    if (!bidder1Client) return;
    const auctionId = await createTestAuction();
    const { data, error } = await (bidder1Client.rpc as any)("place_bid", {
      auction_id: auctionId,
      amount_paise: 10000,
      idempotency_key: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(data).toHaveProperty("id");
    expect(data.replayed).toBe(false);
  });

  it("rejects first bid below starting price", async () => {
    if (!bidder1Client) return;
    const auctionId = await createTestAuction();
    const { error } = await (bidder1Client.rpc as any)("place_bid", {
      auction_id: auctionId,
      amount_paise: 9999,
      idempotency_key: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it("rejects seller bidding on their own auction", async () => {
    if (!sellerClient) return;
    const auctionId = await createTestAuction();
    const { error } = await (sellerClient.rpc as any)("place_bid", {
      auction_id: auctionId,
      amount_paise: 10000,
      idempotency_key: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it("returns replayed=true for same idempotency key", async () => {
    if (!bidder1Client) return;
    const auctionId = await createTestAuction();
    const key = crypto.randomUUID();
    const { data: first } = await (bidder1Client.rpc as any)("place_bid", {
      auction_id: auctionId,
      amount_paise: 10000,
      idempotency_key: key,
    });
    const { data: second } = await (bidder1Client.rpc as any)("place_bid", {
      auction_id: auctionId,
      amount_paise: 10000,
      idempotency_key: key,
    });
    expect(second.replayed).toBe(true);
    expect(second.id).toBe(first.id);
  });
});
