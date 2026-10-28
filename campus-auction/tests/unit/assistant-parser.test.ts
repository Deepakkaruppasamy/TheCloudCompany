import { describe, it, expect } from "vitest";
import { parseStudentMessage } from "@/lib/assistant/parser";

describe("AI Assistant Intent Parser", () => {
  it("extracts category and budget cap for cycle search", () => {
    const res = parseStudentMessage("find me a cycle under ₹2,000");
    expect(res.intent).toBe("search");
    expect(res.category).toBe("cycle");
    expect(res.maxPriceRupees).toBe(2000);
  });

  it("extracts calculator query with below budget constraint", () => {
    const res = parseStudentMessage("scientific calculator below 500");
    expect(res.intent).toBe("search");
    expect(res.category).toBe("calculator");
    expect(res.maxPriceRupees).toBe(500);
  });

  it("extracts bidding proposal intent with proposed amount", () => {
    const res = parseStudentMessage("bid ₹1,800 on the mountain bike");
    expect(res.intent).toBe("bid_proposal");
    expect(res.bidAmountRupees).toBe(1800);
    expect(res.category).toBe("cycle");
  });

  it("returns general_help for non-marketplace queries", () => {
    const res = parseStudentMessage("hello how does this work?");
    expect(res.intent).toBe("general_help");
  });
});
