import { z } from "zod";

export const ValidCategories = [
  "cycle",
  "calculator",
  "books",
  "electronics",
  "other",
] as const;

export const CreateSavedSearchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters"),
  keyword: z
    .string()
    .trim()
    .min(2, "Keyword must be at least 2 characters")
    .max(100, "Keyword must not exceed 100 characters"),
  category: z
    .enum(ValidCategories)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  maxPricePaise: z
    .number()
    .int()
    .positive("Price must be positive")
    .optional()
    .nullable(),
});

export type CreateSavedSearchInput = z.infer<typeof CreateSavedSearchSchema>;
