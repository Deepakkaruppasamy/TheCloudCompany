/**
 * src/domain/auctions.ts
 *
 * Pure auction state rules. No DB, no network, no secrets.
 */

export type AuctionStatus =
  | "active"
  | "closed_unsold"
  | "pending_seller_approval"
  | "reserved"
  | "rejected"
  | "seller_unresponsive"
  | "failed_pickup"
  | "completed"
  | "cancelled_by_seller";

export type AuctionCondition = "new" | "like_new" | "good" | "fair" | "for_parts";
export type AuctionCategory =
  | "cycle"
  | "calculator"
  | "books"
  | "electronics"
  | "other";

export const CONDITION_LABELS: Record<AuctionCondition, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  for_parts: "For Parts",
};

export const CATEGORY_LABELS: Record<AuctionCategory, string> = {
  cycle: "Cycle",
  calculator: "Calculator",
  books: "Books",
  electronics: "Electronics",
  other: "Other",
};

export const STATUS_LABELS: Record<AuctionStatus, string> = {
  active: "Active",
  closed_unsold: "Unsold",
  pending_seller_approval: "Awaiting Seller",
  reserved: "Reserved",
  rejected: "Rejected",
  seller_unresponsive: "Seller Unresponsive",
  failed_pickup: "Pickup Failed",
  completed: "Completed",
  cancelled_by_seller: "Cancelled",
};

/** Returns true when a new bid can be placed (purely date-based, DB is authoritative) */
export function isAuctionBiddable(
  status: AuctionStatus,
  opensAt: Date | string,
  closesAt: Date | string,
  now: Date = new Date()
): boolean {
  if (status !== "active") return false;
  const opens = typeof opensAt === "string" ? new Date(opensAt) : opensAt;
  const closes = typeof closesAt === "string" ? new Date(closesAt) : closesAt;
  return now >= opens && now < closes;
}

/** Returns true when the seller can edit (no bids, active, before close) */
export function isAuctionEditable(
  status: AuctionStatus,
  firstBidAt: Date | string | null,
  closesAt: Date | string,
  now: Date = new Date()
): boolean {
  if (status !== "active") return false;
  if (firstBidAt !== null) return false;
  const closes = typeof closesAt === "string" ? new Date(closesAt) : closesAt;
  return now < closes;
}

/** Returns true when seller can cancel (no bids, active) */
export function isAuctionCancellable(
  status: AuctionStatus,
  firstBidAt: Date | string | null
): boolean {
  return status === "active" && firstBidAt === null;
}

/** Returns true when the auction is closing within 24 hours */
export function isClosingSoon(
  closesAt: Date | string,
  now: Date = new Date()
): boolean {
  const closes = typeof closesAt === "string" ? new Date(closesAt) : closesAt;
  const diffMs = closes.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 86_400_000;
}
