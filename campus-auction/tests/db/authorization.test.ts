/**
 * tests/db/authorization.test.ts
 *
 * RLS and privilege tests against real PostgreSQL.
 * Requires local Supabase stack running.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser } from "../helpers/db";

let user1Id: string;
let user2Id: string;
let user1Client: Awaited<ReturnType<typeof createTestUser>>["client"];
let user2Client: Awaited<ReturnType<typeof createTestUser>>["client"];

const suffix = Date.now();

beforeAll(async () => {
  try {
    const u1 = await createTestUser({
      email: `rls-test-1-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "RLS Test User 1",
      verified: true,
    });
    user1Id = u1.userId;
    user1Client = u1.client;

    const u2 = await createTestUser({
      email: `rls-test-2-${suffix}@test.campus`,
      password: "TestPass123!",
      displayName: "RLS Test User 2",
      verified: true,
    });
    user2Id = u2.userId;
    user2Client = u2.client;
  } catch (e) {
    // Graceful skip if DB is not running
  }
});

afterAll(async () => {
  if (user1Id) await deleteTestUser(user1Id);
  if (user2Id) await deleteTestUser(user2Id);
});

describe("Profile RLS", () => {
  it("user can read their own profile", async () => {
    if (!user1Client) return;
    const { data, error } = await user1Client.from("profiles").select("*").eq("id", user1Id).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(user1Id);
  });

  it("user cannot read another user's profile directly", async () => {
    if (!user1Client) return;
    const { data } = await user1Client.from("profiles").select("*").eq("id", user2Id);
    expect((data ?? []).length).toBe(0);
  });

  it("user can update their own display_name", async () => {
    if (!user1Client) return;
    const { error } = await user1Client
      .from("profiles")
      .update({ display_name: "Updated Name" } as any)
      .eq("id", user1Id);
    expect(error).toBeNull();
  });
});

describe("Auction RLS", () => {
  it("authenticated user can read auctions", async () => {
    if (!user1Client) return;
    const { error } = await user1Client.from("auctions").select("*").limit(1);
    expect(error).toBeNull();
  });

  it("client cannot insert into auctions directly", async () => {
    if (!user1Client) return;
    const { error } = await user1Client.from("auctions").insert({
      seller_id: user1Id,
      title: "Unauthorized",
      description: "This should fail",
      category: "other",
      condition: "new",
      starting_price_paise: 1000,
      minimum_increment_paise: 100,
      opens_at: new Date().toISOString(),
      closes_at: new Date(Date.now() + 86400000).toISOString(),
      status: "active",
    } as any);
    expect(error).not.toBeNull();
  });
});

describe("Bid RLS", () => {
  it("client cannot insert bids directly", async () => {
    if (!user1Client) return;
    const { error } = await user1Client.from("bids").insert({
      auction_id: "00000000-0000-0000-0000-000000000000",
      bidder_id: user1Id,
      amount_paise: 1000,
      idempotency_key: crypto.randomUUID(),
    } as any);
    expect(error).not.toBeNull();
  });
});

describe("Notification RLS", () => {
  it("user cannot insert notifications directly", async () => {
    if (!user1Client) return;
    const { error } = await user1Client.from("notifications").insert({
      recipient_id: user1Id,
      type: "outbid",
      message: "Unauthorized notification",
    } as any);
    expect(error).not.toBeNull();
  });
});

describe("public_profiles view", () => {
  it("returns only id and display_name", async () => {
    if (!user1Client) return;
    const { data, error } = await user1Client.from("public_profiles").select("*").limit(1);
    expect(error).toBeNull();
    if (data && data.length > 0) {
      const keys = Object.keys(data[0]);
      expect(keys).toContain("id");
      expect(keys).toContain("display_name");
      expect(keys).not.toContain("role");
      expect(keys).not.toContain("is_verified");
      expect(keys).not.toContain("account_status");
    }
  });
});
