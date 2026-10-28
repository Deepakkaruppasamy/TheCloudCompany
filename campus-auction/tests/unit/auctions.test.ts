/**
 * tests/unit/auctions.test.ts
 *
 * Unit tests for auction domain rules.
 */
import { describe, it, expect } from "vitest";
import {
  isAuctionBiddable,
  isAuctionEditable,
  isAuctionCancellable,
  isClosingSoon,
} from "@/domain/auctions";

const now = new Date("2024-06-15T12:00:00Z");
const past = new Date("2024-06-15T11:00:00Z");
const future = new Date("2024-06-15T13:00:00Z");

describe("isAuctionBiddable", () => {
  it("returns true for active auction in open window", () => {
    expect(isAuctionBiddable("active", past, future, now)).toBe(true);
  });

  it("returns false when status is not active", () => {
    expect(isAuctionBiddable("closed_unsold", past, future, now)).toBe(false);
  });

  it("returns false when now >= closes_at", () => {
    expect(isAuctionBiddable("active", past, now, now)).toBe(false);
  });

  it("returns false when now < opens_at", () => {
    expect(isAuctionBiddable("active", future, new Date("2024-06-15T14:00:00Z"), now)).toBe(false);
  });
});

describe("isAuctionEditable", () => {
  it("returns true for active with no bids and before close", () => {
    expect(isAuctionEditable("active", null, future, now)).toBe(true);
  });

  it("returns false when first_bid_at is set", () => {
    expect(isAuctionEditable("active", past, future, now)).toBe(false);
  });

  it("returns false when status is not active", () => {
    expect(isAuctionEditable("closed_unsold", null, future, now)).toBe(false);
  });

  it("returns false after close", () => {
    expect(isAuctionEditable("active", null, past, now)).toBe(false);
  });
});

describe("isAuctionCancellable", () => {
  it("returns true for active with no bids", () => {
    expect(isAuctionCancellable("active", null)).toBe(true);
  });

  it("returns false when bid exists", () => {
    expect(isAuctionCancellable("active", past)).toBe(false);
  });

  it("returns false when status is not active", () => {
    expect(isAuctionCancellable("closed_unsold", null)).toBe(false);
  });
});

describe("isClosingSoon", () => {
  it("returns true when closing within 24 hours", () => {
    const soonClose = new Date(now.getTime() + 3_600_000); // 1 hour from now
    expect(isClosingSoon(soonClose, now)).toBe(true);
  });

  it("returns false when already closed", () => {
    expect(isClosingSoon(past, now)).toBe(false);
  });

  it("returns false when more than 24 hours away", () => {
    const farClose = new Date(now.getTime() + 86_400_000 + 1000);
    expect(isClosingSoon(farClose, now)).toBe(false);
  });
});
