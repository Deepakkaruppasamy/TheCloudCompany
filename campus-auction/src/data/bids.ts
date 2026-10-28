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
  if (error) throw new Error(error.message);
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
  };
}
