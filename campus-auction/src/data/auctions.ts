/**
 * src/data/auctions.ts
 *
 * Supabase queries and RPC calls for auctions.
 * No UI code; no authorization decisions.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Auction = Database["public"]["Tables"]["auctions"]["Row"];

export interface AuctionFilter {
  category?: string;
  condition?: string;
  search?: string;
  maxPricePaise?: number;
  minPricePaise?: number;
  closingSoon?: boolean;
}

export async function listAuctions(
  filter: AuctionFilter = {},
  page: number = 1,
  pageSize: number = 12
): Promise<{ auctions: Auction[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("auctions")
    .select("*", { count: "exact" })
    .eq("status", "active");

  if (filter.category) query = query.eq("category", filter.category);
  if (filter.condition) query = query.eq("condition", filter.condition);

  if (filter.search) {
    query = query.textSearch("title", filter.search, {
      type: "websearch",
      config: "english",
    });
  }

  if (filter.closingSoon) {
    const now = new Date();
    const soon = new Date(now.getTime() + 86_400_000);
    query = query
      .gte("closes_at", now.toISOString())
      .lte("closes_at", soon.toISOString());
  }

  query = query.order("closes_at", { ascending: true });

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { auctions: data ?? [], total: count ?? 0 };
}

export async function getAuction(id: string): Promise<Auction | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function getMyListings(sellerId: string): Promise<Auction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSellerDisplayName(
  sellerId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("display_name")
    .eq("id", sellerId)
    .maybeSingle();

  if (error) return null;

  const row = data as { display_name?: string } | null;
  return row?.display_name ?? null;
}

export async function createAuctionRpc(params: {
  title: string;
  description: string;
  category: string;
  condition: string;
  startingPricePaise: number;
  minimumIncrementPaise: number;
  opensAt: string;
  closesAt: string;
  photoPath?: string | null;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_auction", {
    title: params.title,
    description: params.description,
    category: params.category,
    condition: params.condition,
    starting_price_paise: params.startingPricePaise,
    minimum_increment_paise: params.minimumIncrementPaise,
    opens_at: params.opensAt,
    closes_at: params.closesAt,
    photo_path: params.photoPath ?? null,
  } as any);
  if (error) throw error;
  return data as string;
}

export async function editAuctionRpc(params: {
  auctionId: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  photoPath?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_auction", {
    auction_id: params.auctionId,
    title: params.title,
    description: params.description,
    category: params.category,
    condition: params.condition,
    photo_path: params.photoPath ?? null,
  } as any);
  if (error) throw error;
}

export async function cancelAuctionRpc(
  auctionId: string,
  reason: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_auction", {
    auction_id: auctionId,
    reason,
  } as any);
  if (error) throw error;
}

export async function getPublicStats(): Promise<{ active_auctions: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_stats" as any);
  if (error) throw new Error(error.message);
  return data as { active_auctions: number };
}
