/**
 * src/domain/bidding.ts
 *
 * Pure bidding rules. No DB, network, or secrets.
 */

/** Maps database error codes to user-facing messages */
export const BID_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "You must be signed in to place a bid.",
  not_eligible: "Your account is not eligible to bid. Contact support.",
  auction_not_active: "This auction is not currently active.",
  auction_not_open: "This auction has not opened yet.",
  auction_closed: "This auction has already closed.",
  seller_cannot_bid: "You cannot bid on your own listing.",
  bid_too_low: "Your bid is too low. Please increase your bid amount.",
  unknown: "Something went wrong placing your bid. Please try again.",
};

/** Converts a Supabase function error code or message to a user-facing message */
export function getBidErrorMessage(codeOrMessage: string | undefined): string {
  if (!codeOrMessage) return BID_ERROR_MESSAGES.unknown;
  const normalized = codeOrMessage.toLowerCase();

  for (const [key, msg] of Object.entries(BID_ERROR_MESSAGES)) {
    if (key !== "unknown" && normalized.includes(key)) {
      return msg;
    }
  }

  return BID_ERROR_MESSAGES[codeOrMessage] ?? BID_ERROR_MESSAGES.unknown;
}
