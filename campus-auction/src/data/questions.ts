/**
 * src/data/questions.ts
 *
 * Data access and RPC calls for auction questions.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type QuestionViewRow = Database["public"]["Views"]["auction_questions_public"]["Row"];

export async function getAuctionQuestions(auctionId: string): Promise<QuestionViewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auction_questions_public")
    .select("*")
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getAuctionQuestions error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function askQuestionRpc(auctionId: string, question: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ask_question", {
    auction_id: auctionId,
    question,
  } as any);

  if (error) throw error;
  return data as string;
}

export async function answerQuestionRpc(questionId: string, answer: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_question", {
    question_id: questionId,
    answer,
  } as any);

  if (error) throw error;
}

export async function hideQuestionRpc(questionId: string, reason: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("hide_question", {
    question_id: questionId,
    reason,
  } as any);

  if (error) throw error;
}
