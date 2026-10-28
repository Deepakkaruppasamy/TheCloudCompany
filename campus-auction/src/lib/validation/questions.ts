import { z } from "zod";

export const AskQuestionSchema = z.object({
  auctionId: z.string().uuid("Invalid auction ID"),
  question: z
    .string()
    .trim()
    .min(5, "Question must be at least 5 characters")
    .max(500, "Question must not exceed 500 characters"),
});

export const AnswerQuestionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  answer: z
    .string()
    .trim()
    .min(1, "Answer cannot be empty")
    .max(1000, "Answer must not exceed 1000 characters"),
});

export const HideQuestionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required to hide a question")
    .max(200, "Reason must not exceed 200 characters"),
});

export type AskQuestionInput = z.infer<typeof AskQuestionSchema>;
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>;
export type HideQuestionInput = z.infer<typeof HideQuestionSchema>;
