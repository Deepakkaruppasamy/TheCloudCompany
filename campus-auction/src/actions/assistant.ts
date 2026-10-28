"use server";
/**
 * src/actions/assistant.ts
 *
 * AI Marketplace Assistant server actions.
 * Read-only structured search and human-confirmed assisted bidding proposals.
 */
import { listAuctions } from "@/data/auctions";
import { parseStudentMessage } from "@/lib/assistant/parser";
import { formatPaise } from "@/domain/money";
import type { Database } from "@/types/database";

type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];

export interface AssistantResponse {
  reply: string;
  matchedAuctions: Array<{
    id: string;
    title: string;
    category: string;
    condition: string;
    currentPricePaise: number;
    closesAt: string;
    photoPath?: string | null;
  }>;
  proposal?: {
    auctionId: string;
    auctionTitle: string;
    proposedRupees: number;
    currentPricePaise: number;
    type: "direct" | "auto_bid";
  };
}

export async function chatWithAssistant(userMessage: string): Promise<AssistantResponse> {
  const intent = parseStudentMessage(userMessage);

  if (intent.intent === "general_help") {
    return {
      reply: "Hi! I am your Campus Auction Assistant. You can ask me to find items like \"find me a cycle under ₹2,000\" or ask to prepare a bid proposal like \"bid ₹1,500 on the Casio calculator\". How can I help you today?",
      matchedAuctions: [],
    };
  }

  // Fetch active listings
  const { auctions } = await listAuctions(
    {
      category: intent.category,
      search: intent.keyword,
    },
    1,
    10
  );

  // Apply budget filter
  let filtered = auctions.filter((a) => a.status === "active");
  if (intent.maxPriceRupees) {
    const maxPaise = Math.round(intent.maxPriceRupees * 100);
    filtered = filtered.filter(
      (a) => (a.current_price_paise ?? a.starting_price_paise) <= maxPaise
    );
  }

  const matched = filtered.slice(0, 5).map((a) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    condition: a.condition,
    currentPricePaise: a.current_price_paise ?? a.starting_price_paise,
    closesAt: a.closes_at,
    photoPath: a.photo_path,
  }));

  // Handle bidding proposal
  if (intent.intent === "bid_proposal" && intent.bidAmountRupees) {
    if (matched.length > 0) {
      const target = matched[0];
      return {
        reply: `I found ${target.title}. You asked to bid ₹${intent.bidAmountRupees}. Per campus security rules, I cannot place bids autonomously. Please review the proposal card below and click to confirm:`,
        matchedAuctions: [target],
        proposal: {
          auctionId: target.id,
          auctionTitle: target.title,
          proposedRupees: intent.bidAmountRupees,
          currentPricePaise: target.currentPricePaise,
          type: "auto_bid",
        },
      };
    } else {
      return {
        reply: `You asked to bid ₹${intent.bidAmountRupees}, but I couldn't find an active listing matching "${intent.keyword || "your query"}". Try searching for a listed item first.`,
        matchedAuctions: [],
      };
    }
  }

  // Standard search results response
  if (matched.length === 0) {
    const budgetStr = intent.maxPriceRupees ? ` under ₹${intent.maxPriceRupees}` : "";
    return {
      reply: `I couldn't find any active listings for "${intent.keyword || intent.category}"${budgetStr}. You can set an alert in the "Alerts" tab to be notified the moment one is listed!`,
      matchedAuctions: [],
    };
  }

  const budgetStr = intent.maxPriceRupees ? ` under ₹${intent.maxPriceRupees}` : "";
  return {
    reply: `I found ${matched.length} active item${matched.length > 1 ? "s" : ""} matching your request${budgetStr}:`,
    matchedAuctions: matched,
  };
}
