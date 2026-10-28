/**
 * src/lib/assistant/parser.ts
 *
 * Deterministic natural-language parser for campus auction requests.
 * Extracts search keywords, category filters, budget caps, and bidding proposals.
 */
import type { AuctionCategory } from "@/domain/auctions";

export interface ParsedAssistantIntent {
  intent: "search" | "bid_proposal" | "general_help";
  category?: AuctionCategory;
  keyword?: string;
  maxPriceRupees?: number;
  bidAmountRupees?: number;
  targetItemTitle?: string;
}

export function parseStudentMessage(text: string): ParsedAssistantIntent {
  const clean = text.toLowerCase().trim();

  // 0. Detect Greetings / Help queries without specific item search
  if (
    /^(hi|hello|hey|help|howdy|what can you do|how does this work|who are you)\b/i.test(clean) &&
    !clean.match(/\b(cycle|bike|calculator|book|laptop|phone|bid)\b/i)
  ) {
    return { intent: "general_help" };
  }

  // 1. Detect Category
  let category: AuctionCategory | undefined;
  if (/\b(cycle|bicycle|bike|roadeo|hercules|gear)\b/i.test(clean)) {
    category = "cycle";
  } else if (/\b(calculator|calc|casio|fx|scientific)\b/i.test(clean)) {
    category = "calculator";
  } else if (/\b(book|textbook|author|edition|notes)\b/i.test(clean)) {
    category = "books";
  } else if (/\b(laptop|monitor|phone|mouse|keyboard|charger|electronics|headphone)\b/i.test(clean)) {
    category = "electronics";
  }

  // 2. Detect Price / Budget Bounds ("under 2000", "under ₹2,000", "below 1500", "max 800", "budget 500")
  let maxPriceRupees: number | undefined;
  const budgetMatch = clean.match(
    /(?:under|below|less than|max|budget|within)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i
  );
  if (budgetMatch) {
    const rawVal = budgetMatch[1].replace(/,/g, "");
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 0) {
      maxPriceRupees = val;
    }
  }

  // 3. Detect Bidding Proposal Intent ("bid 1500 on", "bid ₹1,800", "auto bid 2000")
  let bidAmountRupees: number | undefined;
  const bidMatch = clean.match(
    /(?:bid|place bid|auto\s*bid|offer)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i
  );
  if (bidMatch) {
    const rawVal = bidMatch[1].replace(/,/g, "");
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 0) {
      bidAmountRupees = val;
    }
  }

  // 4. Extract keyword (strip noise words)
  const noiseWords = [
    "find", "me", "a", "an", "the", "under", "below", "less", "than",
    "please", "search", "for", "i", "want", "need", "looking", "show", "get", "bid", "on"
  ];
  const words = clean
    .replace(/[₹,?!.]/g, "")
    .split(/\s+/)
    .filter((w) => !noiseWords.includes(w) && !/^\d+$/.test(w));
  const keyword = words.join(" ").trim() || (category ?? "");

  if (bidAmountRupees) {
    return {
      intent: "bid_proposal",
      category,
      keyword,
      bidAmountRupees,
    };
  }

  if (category || maxPriceRupees || keyword) {
    return {
      intent: "search",
      category,
      keyword: keyword || undefined,
      maxPriceRupees,
    };
  }

  return { intent: "general_help" };
}
