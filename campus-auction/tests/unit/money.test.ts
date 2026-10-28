/**
 * tests/unit/money.test.ts
 *
 * Unit tests for money conversion helpers.
 */
import { describe, it, expect } from "vitest";
import { formatPaise, rupeesToPaise, isValidPaise, minimumBidPaise } from "@/domain/money";

describe("rupeesToPaise", () => {
  it("converts a whole number correctly", () => {
    expect(rupeesToPaise(10)).toBe(1000);
  });

  it("converts a decimal string-like float correctly", () => {
    expect(rupeesToPaise(10.5)).toBe(1050);
  });

  it("converts 0.01 to 1 paise", () => {
    expect(rupeesToPaise(0.01)).toBe(1);
  });

  it("handles rounding correctly for 10.10 + 10.20 sum", () => {
    const paise = rupeesToPaise(10.1) + rupeesToPaise(10.2);
    expect(paise).toBe(2030);
  });
});

describe("formatPaise", () => {
  it("formats 1050 as ₹10.50", () => {
    expect(formatPaise(1050)).toBe("₹10.50");
  });

  it("formats 100000 as ₹1,000", () => {
    const result = formatPaise(100000);
    expect(result).toMatch(/₹.*1.*000/);
  });

  it("throws for negative values", () => {
    expect(() => formatPaise(-1)).toThrow();
  });

  it("throws for non-integer values", () => {
    expect(() => formatPaise(10.5)).toThrow();
  });
});

describe("isValidPaise", () => {
  it("returns true for positive integers", () => {
    expect(isValidPaise(100)).toBe(true);
    expect(isValidPaise(1)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isValidPaise(0)).toBe(false);
  });

  it("returns false for negative values", () => {
    expect(isValidPaise(-1)).toBe(false);
  });

  it("returns false for non-integers", () => {
    expect(isValidPaise(10.5)).toBe(false);
  });

  it("returns false for strings", () => {
    expect(isValidPaise("100")).toBe(false);
  });
});

describe("minimumBidPaise", () => {
  it("returns starting price when no current price", () => {
    expect(minimumBidPaise(null, 50000, 5000)).toBe(50000);
  });

  it("returns current price + increment when current price exists", () => {
    expect(minimumBidPaise(60000, 50000, 5000)).toBe(65000);
  });
});
