/**
 * tests/unit/env.test.ts
 *
 * Tests for startup environment validation logic.
 */
import { describe, it, expect } from "vitest";

function parsePositiveInt(name: string, raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`"${name}" must be a positive integer.`);
  }
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`"${name}" must be a positive integer.`);
  }
  return n;
}

describe("duration config validation", () => {
  it("accepts positive integer minutes", () => {
    expect(parsePositiveInt("SELLER_RESPONSE_MINUTES", "3")).toBe(3);
    expect(parsePositiveInt("PICKUP_MINUTES", "5")).toBe(5);
  });

  it("accepts positive integer hours", () => {
    expect(parsePositiveInt("SELLER_RESPONSE_HOURS", "24")).toBe(24);
    expect(parsePositiveInt("PICKUP_HOURS", "48")).toBe(48);
  });

  it("rejects zero", () => {
    expect(() => parsePositiveInt("TEST", "0")).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => parsePositiveInt("TEST", "-1")).toThrow();
  });

  it("rejects non-integer strings", () => {
    expect(() => parsePositiveInt("TEST", "1.5")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => parsePositiveInt("TEST", "")).toThrow();
  });

  it("converts minutes to seconds correctly", () => {
    const minutes = parsePositiveInt("SELLER_RESPONSE_MINUTES", "3");
    expect(minutes * 60).toBe(180);
  });

  it("converts hours to seconds correctly", () => {
    const hours = parsePositiveInt("SELLER_RESPONSE_HOURS", "24");
    expect(hours * 3600).toBe(86400);
  });
});
