/**
 * src/data/transactions.ts
 *
 * Supabase queries and RPC calls for transactions.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export async function getTransactionByAuction(
  auctionId: string
): Promise<Transaction | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("auction_id", auctionId)
    .single();
  return data;
}

export async function getMyWonTransactions(
  winnerId: string
): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("winner_id", winnerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSellerTransactions(
  sellerId: string
): Promise<Transaction[]> {
  const supabase = await createClient();
  // Join via auctions to get seller's transactions
  const { data, error } = await supabase
    .from("transactions")
    .select("*, auctions!inner(seller_id)")
    .eq("auctions.seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

export async function approveAuctionRpc(transactionId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_auction", {
    transaction_id: transactionId,
  } as any);
  if (error) throw error;
}

export async function rejectAuctionRpc(
  transactionId: string,
  reason: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_auction", {
    transaction_id: transactionId,
    reason,
  } as any);
  if (error) throw error;
}

export async function confirmHandoverRpc(transactionId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_handover", {
    transaction_id: transactionId,
  } as any);
  if (error) throw error;
}
