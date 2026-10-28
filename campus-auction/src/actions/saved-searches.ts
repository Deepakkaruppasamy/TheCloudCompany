"use server";
/**
 * src/actions/saved-searches.ts
 *
 * Server Actions for managing saved searches and alerts.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { CreateSavedSearchSchema } from "@/lib/validation/saved-searches";
import {
  createSavedSearchRpc,
  deleteSavedSearchRpc,
  toggleSavedSearchRpc,
} from "@/data/saved-searches";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createSavedSearchAction(
  _prevState: any,
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await requireUser();

    const maxPriceStr = formData.get("maxPrice") as string | null;
    const maxPriceRupees = maxPriceStr ? parseFloat(maxPriceStr) : null;
    const maxPricePaise =
      maxPriceRupees !== null && !isNaN(maxPriceRupees) && maxPriceRupees > 0
        ? Math.round(maxPriceRupees * 100)
        : null;

    const raw = {
      name: formData.get("name"),
      keyword: formData.get("keyword"),
      category: formData.get("category"),
      maxPricePaise,
    };

    const parsed = CreateSavedSearchSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid saved search input." };
    }

    const id = await createSavedSearchRpc({
      name: parsed.data.name,
      keyword: parsed.data.keyword,
      category: parsed.data.category,
      maxPricePaise: parsed.data.maxPricePaise,
    });

    revalidatePath("/saved-searches");
    return { ok: true, data: id };
  } catch (err: any) {
    const msg = err?.message || "Failed to create saved search.";
    if (msg.includes("max_saved_searches_exceeded")) {
      return { ok: false, error: "You can have at most 10 active saved searches." };
    }
    return { ok: false, error: msg };
  }
}

export async function deleteSavedSearchAction(
  savedSearchId: string
): Promise<ActionResult<void>> {
  try {
    await requireUser();
    await deleteSavedSearchRpc(savedSearchId);
    revalidatePath("/saved-searches");
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to delete saved search." };
  }
}

export async function toggleSavedSearchAction(
  savedSearchId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    await requireUser();
    await toggleSavedSearchRpc(savedSearchId, isActive);
    revalidatePath("/saved-searches");
    return { ok: true, data: undefined };
  } catch (err: any) {
    const msg = err?.message || "Failed to update saved search.";
    if (msg.includes("max_saved_searches_exceeded")) {
      return { ok: false, error: "Cannot enable: you already have 10 active alerts." };
    }
    return { ok: false, error: msg };
  }
}
