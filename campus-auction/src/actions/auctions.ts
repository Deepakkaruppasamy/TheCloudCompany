"use server";
/**
 * src/actions/auctions.ts
 *
 * Server Actions for auction create, edit, cancel, and photo upload.
 * Authenticates caller, validates input, calls data layer.
 * Database functions are the authoritative enforcement layer.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CreateAuctionSchema, EditAuctionSchema } from "@/lib/validation/auction";
import {
  createAuctionRpc,
  editAuctionRpc,
  cancelAuctionRpc,
} from "@/data/auctions";
import { getAdminClient } from "@/lib/server/admin";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Upload a photo to the listing-photos private bucket */
export async function uploadListingPhoto(
  formData: FormData
): Promise<ActionResult<string>> {
  const user = await requireUser();
  const file = formData.get("photo") as File | null;

  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, and WebP images are allowed." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "File must be at most 5 MB." };
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${user.id}/${Date.now()}.${ext}`;
  const admin = getAdminClient();

  const { error } = await admin.storage
    .from("listing-photos")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: "Photo upload failed. Please try again." };
  return { ok: true, data: path };
}

/** Create a signed URL for a photo path (server-side, for authorized viewers) */
export async function getPhotoSignedUrl(
  path: string
): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin.storage
    .from("listing-photos")
    .createSignedUrl(path, 3600); // 1 hour
  return data?.signedUrl ?? null;
}

/** Create a new auction */
export async function createAuction(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const startingPricePaise =
    Number(formData.get("startingPricePaise")) ||
    Math.round(Number(formData.get("startingPriceRupees")) * 100);
  const minimumIncrementPaise =
    Number(formData.get("minimumIncrementPaise")) ||
    Math.round(Number(formData.get("minimumIncrementRupees")) * 100);

  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    startingPricePaise,
    minimumIncrementPaise,
    opensAt: formData.get("opensAt"),
    closesAt: formData.get("closesAt"),
    photoPath: formData.get("photoPath") || null,
  };

  const parsed = CreateAuctionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    const id = await createAuctionRpc({
      ...parsed.data,
      photoPath: parsed.data.photoPath ?? null,
    });
    revalidatePath("/");
    return { ok: true, data: { id } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not_eligible"))
      return { ok: false, error: "Your account is not eligible to list items." };
    if (msg.includes("config_missing"))
      return { ok: false, error: "System configuration error. Contact admin." };
    return { ok: false, error: "Failed to create auction. Please try again." };
  }
}

/** Edit an existing auction (no-bid only; enforced by DB) */
export async function editAuction(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const raw = {
    auctionId: formData.get("auctionId"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    photoPath: formData.get("photoPath") || null,
  };

  const parsed = EditAuctionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    await editAuctionRpc({
      ...parsed.data,
      photoPath: parsed.data.photoPath ?? null,
    });
    revalidatePath(`/auctions/${parsed.data.auctionId}`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("auction_has_bids"))
      return { ok: false, error: "Cannot edit after the first bid has been placed." };
    if (msg.includes("not_seller"))
      return { ok: false, error: "You are not the seller of this auction." };
    return { ok: false, error: "Failed to update auction. Please try again." };
  }
}

/** Cancel a zero-bid auction */
export async function cancelAuction(
  auctionId: string,
  reason: string
): Promise<ActionResult> {
  await requireUser();

  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: "A reason is required to cancel." };
  }
  if (reason.length > 300) {
    return { ok: false, error: "Reason must be at most 300 characters." };
  }

  try {
    await cancelAuctionRpc(auctionId, reason);
    revalidatePath("/my-listings");
    redirect("/my-listings");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("has_bids"))
      return { ok: false, error: "Cannot cancel an auction that has received bids." };
    if (msg.includes("not_seller"))
      return { ok: false, error: "You are not the seller of this auction." };
    return { ok: false, error: "Failed to cancel auction. Please try again." };
  }
}
