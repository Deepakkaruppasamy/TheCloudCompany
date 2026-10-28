/**
 * src/data/bids.ts
 *
 * Supabase queries and RPC calls for bids.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type BidHistoryRow = Database["public"]["Views"]["bid_history"]["Row"];

export async function getBidHistory(auctionId: string): Promise<BidHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bid_history")
    .select("*")
    .eq("auction_id", auctionId)
    .order("amount_paise", { ascending: false });
  if (error) {
    console.error("getBidHistory error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function placeBidRpc(params: {
  auctionId: string;
  amountPaise: number;
  idempotencyKey: string;
}): Promise<{
  id: string;
  amount_paise: number;
  placed_at: string;
  replayed: boolean;
  extended?: boolean;
  new_closes_at?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bid", {
    auction_id: params.auctionId,
    amount_paise: params.amountPaise,
    idempotency_key: params.idempotencyKey,
  } as any);
  if (error) throw error;
  return data as {
    id: string;
    amount_paise: number;
    placed_at: string;
    replayed: boolean;
    extended?: boolean;
    new_closes_at?: string;
  };
}

export async function getMyAutoBid(auctionId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auto_bids")
    .select("max_amount_paise")
    .eq("auction_id", auctionId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as any).max_amount_paise;
}

export async function setAutoBidRpc(params: {
  auctionId: string;
  maxAmountPaise: number;
}): Promise<any> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_auto_bid", {
    auction_id: params.auctionId,
    max_amount_paise: params.maxAmountPaise,
  } as any);
  if (error) throw error;
  return data;
}
