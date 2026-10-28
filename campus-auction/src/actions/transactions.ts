"use server";
/**
 * src/actions/transactions.ts
 *
 * Server Actions for seller decisions and handover confirmation.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  approveAuctionRpc,
  rejectAuctionRpc,
  confirmHandoverRpc,
} from "@/data/transactions";
import { createNotification } from "@/data/notifications";

export type TransactionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function approveAuction(
  transactionId: string
): Promise<TransactionResult> {
  const user = await requireUser();
  try {
    await approveAuctionRpc(transactionId);
    await createNotification({
      recipientId: user.id,
      type: "seller_approved",
      message: "You approved the winning bid. The item is reserved for campus handover.",
      transactionId,
    });
    revalidatePath("/dashboard/seller");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not_seller"))
      return { ok: false, error: "You are not the seller of this auction." };
    if (msg.includes("deadline_expired"))
      return { ok: false, error: "The approval deadline has passed." };
    if (msg.includes("wrong_state"))
      return { ok: false, error: "This transaction is not awaiting your approval." };
    if (msg.includes("config_missing"))
      return { ok: false, error: "System configuration error. Contact admin." };
    return { ok: false, error: "Failed to approve. Please try again." };
  }
}

export async function rejectAuction(
  transactionId: string,
  reason: string
): Promise<TransactionResult> {
  const user = await requireUser();
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: "A reason is required." };
  }
  if (reason.length > 300) {
    return { ok: false, error: "Reason must be at most 300 characters." };
  }
  try {
    await rejectAuctionRpc(transactionId, reason);
    await createNotification({
      recipientId: user.id,
      type: "seller_rejected",
      message: `You rejected the winning bid. Reason: ${reason}.`,
      transactionId,
    });
    revalidatePath("/dashboard/seller");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not_seller"))
      return { ok: false, error: "You are not the seller of this auction." };
    if (msg.includes("deadline_expired"))
      return { ok: false, error: "The rejection deadline has passed." };
    return { ok: false, error: "Failed to reject. Please try again." };
  }
}

export async function confirmHandover(
  transactionId: string
): Promise<TransactionResult> {
  const user = await requireUser();
  try {
    await confirmHandoverRpc(transactionId);
    await createNotification({
      recipientId: user.id,
      type: "handover_completed",
      message: "Handover confirmation recorded.",
      transactionId,
    });
    revalidatePath("/dashboard/seller");
    revalidatePath("/dashboard/winner");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not_party"))
      return { ok: false, error: "You are not a party to this transaction." };
    if (msg.includes("pickup_deadline_expired"))
      return { ok: false, error: "The pickup deadline has passed." };
    if (msg.includes("already_confirmed"))
      return { ok: false, error: "You have already confirmed this handover." };
    return { ok: false, error: "Failed to confirm handover. Please try again." };
  }
}
