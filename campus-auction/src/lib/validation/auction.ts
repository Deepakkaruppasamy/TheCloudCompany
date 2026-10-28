/**
 * src/lib/validation/auction.ts
 *
 * Shared Zod schemas for auction create/edit input.
 */
import { z } from "zod";

export const CATEGORIES = [
  "cycle",
  "calculator",
  "books",
  "electronics",
  "other",
] as const;

export const CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "for_parts",
] as const;

const DateTimeSchema = z
  .string()
  .min(1, "Date is required")
  .transform((val, ctx) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date format" });
      return z.NEVER;
    }
    return d.toISOString();
  });

export const CreateAuctionSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(2000),
    category: z.enum(CATEGORIES),
    condition: z.enum(CONDITIONS),
    startingPricePaise: z
      .number()
      .int("Price must be a whole number of paise")
      .positive("Starting price must be positive"),
    minimumIncrementPaise: z
      .number()
      .int("Increment must be a whole number of paise")
      .positive("Minimum increment must be positive"),
    opensAt: DateTimeSchema,
    closesAt: DateTimeSchema,
    photoPath: z.string().nullable().optional(),
  })
  .refine(
    (data) => new Date(data.closesAt).getTime() > new Date(data.opensAt).getTime(),
    {
      message: "Closing time must be after opening time",
      path: ["closesAt"],
    }
  );

export const EditAuctionSchema = z.object({
  auctionId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  photoPath: z.string().nullable().optional(),
});

export type CreateAuctionInput = z.infer<typeof CreateAuctionSchema>;
export type EditAuctionInput = z.infer<typeof EditAuctionSchema>;
