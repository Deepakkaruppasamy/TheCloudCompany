/**
 * tests/unit/bidding.test.ts
 *
 * Unit tests for bidding error handling and message parsing.
 */
import { describe, it, expect } from "vitest";
import { getBidErrorMessage, BID_ERROR_MESSAGES } from "@/domain/bidding";

describe("getBidErrorMessage", () => {
  it("maps raw domain code correctly", () => {
    expect(getBidErrorMessage("seller_cannot_bid")).toBe(
      BID_ERROR_MESSAGES.seller_cannot_bid
    );
    expect(getBidErrorMessage("bid_too_low")).toBe(
      BID_ERROR_MESSAGES.bid_too_low
    );
    expect(getBidErrorMessage("auction_closed")).toBe(
      BID_ERROR_MESSAGES.auction_closed
    );
  });

  it("handles PostgREST compound error strings where code is P0001", () => {
    expect(getBidErrorMessage("seller_cannot_bid P0001")).toBe(
      BID_ERROR_MESSAGES.seller_cannot_bid
    );
    expect(getBidErrorMessage("bid_too_low P0001 minimum:165000")).toBe(
      BID_ERROR_MESSAGES.bid_too_low
    );
  });

  it("returns unknown error message for undefined or unexpected errors", () => {
    expect(getBidErrorMessage(undefined)).toBe(BID_ERROR_MESSAGES.unknown);
    expect(getBidErrorMessage("random_unexpected_failure")).toBe(
      BID_ERROR_MESSAGES.unknown
    );
  });
});

