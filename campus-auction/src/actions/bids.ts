"use server";
/**
 * src/actions/bids.ts
 *
 * Server Action for placing a bid.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { PlaceBidSchema } from "@/lib/validation/bid";
import { placeBidRpc } from "@/data/bids";
import { getBidErrorMessage } from "@/domain/bidding";

export type BidResult =
  | { ok: true; data: { id: string; replayed: boolean } }
  | { ok: false; error: string; minRequired?: number };

export async function placeBid(
  prevState: BidResult | null,
  formData: FormData
): Promise<BidResult> {
  await requireUser();

  const raw = {
    auctionId: formData.get("auctionId"),
    amountPaise: Number(formData.get("amountPaise")),
    idempotencyKey: formData.get("idempotencyKey"),
  };

  const parsed = PlaceBidSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    const result = await placeBidRpc(parsed.data);
    revalidatePath(`/auctions/${parsed.data.auctionId}`);
    return { ok: true, data: { id: result.id, replayed: result.replayed } };
  } catch (err: unknown) {
    // Extract Postgres error code from Supabase error
    const anyErr = err as { code?: string; message?: string; details?: string };
    const code = anyErr?.code ?? anyErr?.message ?? "";
    const message = getBidErrorMessage(code);

    // Extract minimum required amount from error details if available
    let minRequired: number | undefined;
    if (anyErr?.details) {
      const match = anyErr.details.match(/minimum[:\s]+(\d+)/i);
      if (match) minRequired = parseInt(match[1], 10);
    }

    return { ok: false, error: message, minRequired };
  }
}
