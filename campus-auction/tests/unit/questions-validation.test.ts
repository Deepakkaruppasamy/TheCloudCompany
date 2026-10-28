import { describe, it, expect } from "vitest";
import {
  AskQuestionSchema,
  AnswerQuestionSchema,
  HideQuestionSchema,
} from "@/lib/validation/questions";

describe("Questions Validation Schemas", () => {
  const validAuctionId = "11111111-1111-4111-a111-111111111111";
  const validQuestionId = "22222222-2222-4222-a222-222222222222";

  describe("AskQuestionSchema", () => {
    it("accepts valid question input", () => {
      const res = AskQuestionSchema.safeParse({
        auctionId: validAuctionId,
        question: "Does this bicycle have both front and rear brakes functioning?",
      });
      expect(res.success).toBe(true);
    });

    it("rejects question shorter than 5 chars", () => {
      const res = AskQuestionSchema.safeParse({
        auctionId: validAuctionId,
        question: "Hi?",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("at least 5 characters");
      }
    });

    it("rejects question longer than 500 chars", () => {
      const res = AskQuestionSchema.safeParse({
        auctionId: validAuctionId,
        question: "a".repeat(501),
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("not exceed 500 characters");
      }
    });

    it("rejects invalid auction UUID", () => {
      const res = AskQuestionSchema.safeParse({
        auctionId: "not-a-uuid",
        question: "Is this still available for inspection?",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("AnswerQuestionSchema", () => {
    it("accepts valid answer input", () => {
      const res = AnswerQuestionSchema.safeParse({
        questionId: validQuestionId,
        answer: "Yes, both brake cables were replaced last semester.",
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty answer", () => {
      const res = AnswerQuestionSchema.safeParse({
        questionId: validQuestionId,
        answer: "   ",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("cannot be empty");
      }
    });

    it("rejects answer longer than 1000 chars", () => {
      const res = AnswerQuestionSchema.safeParse({
        questionId: validQuestionId,
        answer: "x".repeat(1001),
      });
      expect(res.success).toBe(false);
    });
  });

  describe("HideQuestionSchema", () => {
    it("accepts valid hide moderation input", () => {
      const res = HideQuestionSchema.safeParse({
        questionId: validQuestionId,
        reason: "Off-topic solicitation / spam link.",
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty reason", () => {
      const res = HideQuestionSchema.safeParse({
        questionId: validQuestionId,
        reason: "",
      });
      expect(res.success).toBe(false);
    });
  });
});
