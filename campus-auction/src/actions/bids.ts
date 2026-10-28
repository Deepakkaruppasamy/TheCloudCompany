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
import { getAuction } from "@/data/auctions";
import { createNotification } from "@/data/notifications";
import { getBidErrorMessage } from "@/domain/bidding";

export type BidResult =
  | { ok: true; data: { id: string; replayed: boolean } }
  | { ok: false; error: string; minRequired?: number };

export async function placeBid(
  prevState: BidResult | null,
  formData: FormData
): Promise<BidResult> {
  const user = await requireUser();

  const rawAmount = formData.get("amountPaise");
  const rawRupees = formData.get("amountRupees");
  const amountPaise =
    rawAmount !== null && rawAmount !== "" && !isNaN(Number(rawAmount))
      ? Number(rawAmount)
      : Math.round(Number(rawRupees) * 100);

  const raw = {
    auctionId: formData.get("auctionId"),
    amountPaise,
    idempotencyKey: formData.get("idempotencyKey") || crypto.randomUUID(),
  };

  const parsed = PlaceBidSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    const result = await placeBidRpc(parsed.data);
    revalidatePath(`/auctions/${parsed.data.auctionId}`);

    if (!result.replayed) {
      const auction = await getAuction(parsed.data.auctionId).catch(() => null);
      const amountRupees = (parsed.data.amountPaise / 100).toFixed(0);
      const title = auction?.title ? `"${auction.title}"` : "the item";

      // 1. Notify Bidder
      await createNotification({
        recipientId: user.id,
        type: "bid_placed",
        message: `You placed a leading bid of ₹${amountRupees} on ${title}.`,
        auctionId: parsed.data.auctionId,
        bidId: result.id,
      });

      // 2. Notify Seller
      if (auction && auction.seller_id !== user.id) {
        await createNotification({
          recipientId: auction.seller_id,
          type: "bid_received",
          message: `New bid received: A student placed a bid of ₹${amountRupees} on your listing ${title}.`,
          auctionId: parsed.data.auctionId,
          bidId: result.id,
        });
      }
    }

    return { ok: true, data: { id: result.id, replayed: result.replayed } };
  } catch (err: unknown) {
    console.error("[placeBid] Error:", err);
    const anyErr = err as { code?: string; message?: string; details?: string };

    // In Supabase PostgREST, custom RAISE EXCEPTION errors have code 'P0001',
    // while the domain error key ('bid_too_low', 'seller_cannot_bid', etc.) is in message!
    const errText = [anyErr?.message, anyErr?.code, anyErr?.details]
      .filter(Boolean)
      .join(" ");

    let message = getBidErrorMessage(errText);

    // Extract minimum required amount from error details if available
    let minRequired: number | undefined;
    if (anyErr?.details) {
      const match = anyErr.details.match(/minimum[:\s]+(\d+)/i);
      if (match) minRequired = parseInt(match[1], 10);
    }

    if (minRequired && errText.includes("bid_too_low")) {
      message = `Your bid is too low. Minimum required bid is ₹${(minRequired / 100).toFixed(0)}.`;
    }

    return { ok: false, error: message, minRequired };
  }
}
