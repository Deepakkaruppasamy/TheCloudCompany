/**
 * src/lib/validation/bid.ts
 *
 * Zod schema for bid placement.
 */
import { z } from "zod";

export const PlaceBidSchema = z.object({
  auctionId: z.string().uuid(),
  amountPaise: z
    .number()
    .int("Bid amount must be a whole number of paise")
    .positive("Bid amount must be positive"),
  idempotencyKey: z.string().uuid(),
});

export type PlaceBidInput = z.infer<typeof PlaceBidSchema>;
