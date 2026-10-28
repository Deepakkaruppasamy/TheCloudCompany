import { describe, it, expect } from "vitest";
import { CreateSavedSearchSchema } from "@/lib/validation/saved-searches";

describe("Saved Searches Validation Schema", () => {
  it("accepts valid full saved search input", () => {
    const res = CreateSavedSearchSchema.safeParse({
      name: "Engineering Calculator",
      keyword: "casio fx-991ex",
      category: "electronics",
      maxPricePaise: 80000,
    });
    expect(res.success).toBe(true);
  });

  it("accepts valid minimal saved search (keyword and name only)", () => {
    const res = CreateSavedSearchSchema.safeParse({
      name: "Cycle alert",
      keyword: "hercules",
      category: null,
      maxPricePaise: null,
    });
    expect(res.success).toBe(true);
  });

  it("rejects keyword shorter than 2 characters", () => {
    const res = CreateSavedSearchSchema.safeParse({
      name: "Short",
      keyword: "c",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain("at least 2 characters");
    }
  });

  it("rejects invalid category string", () => {
    const res = CreateSavedSearchSchema.safeParse({
      name: "Invalid Cat",
      keyword: "gadget",
      category: "automotive",
    });
    expect(res.success).toBe(false);
  });

  it("rejects negative max price", () => {
    const res = CreateSavedSearchSchema.safeParse({
      name: "Negative Price",
      keyword: "laptop",
      maxPricePaise: -100,
    });
    expect(res.success).toBe(false);
  });
});
