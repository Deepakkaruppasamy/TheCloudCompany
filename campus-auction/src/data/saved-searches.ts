/**
 * src/data/saved-searches.ts
 *
 * Data access and RPC calls for saved searches and alerts.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

export async function getSavedSearches(): Promise<SavedSearchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getSavedSearches error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function createSavedSearchRpc(params: {
  name: string;
  keyword: string;
  category?: string | null;
  maxPricePaise?: number | null;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_saved_search", {
    name: params.name,
    keyword: params.keyword,
    category: params.category ?? null,
    max_price_paise: params.maxPricePaise ?? null,
  } as any);

  if (error) throw error;
  return data as string;
}

export async function deleteSavedSearchRpc(savedSearchId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_saved_search", {
    saved_search_id: savedSearchId,
  } as any);

  if (error) throw error;
}

export async function toggleSavedSearchRpc(savedSearchId: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_saved_search", {
    saved_search_id: savedSearchId,
    is_active: isActive,
  } as any);

  if (error) throw error;
}
