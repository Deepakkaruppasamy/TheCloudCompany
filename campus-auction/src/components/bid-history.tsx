/**
 * src/components/bid-history.tsx
 *
 * Shows the bid history for an auction using the bid_history view.
 * Bidder ID is never exposed — only display name, amount, and time.
 */
import type { Database } from "@/types/database";
import { formatPaise } from "@/domain/money";
import { formatDate } from "@/lib/time";

type BidHistoryRow = Database["public"]["Views"]["bid_history"]["Row"];

interface BidHistoryProps {
  bids: BidHistoryRow[];
}

export default function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <div className="glass p-6 text-center text-white/40 text-sm">
        No bids yet. Be the first to bid!
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h3 className="font-display font-semibold text-white text-sm">
          Bid History ({bids.length})
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        {bids.map((bid, i) => (
          <div
            key={`${bid.placed_at}-${i}`}
            className={`flex items-center justify-between px-5 py-3 transition-colors ${
              i === 0 ? "bg-brand-500/10" : "hover:bg-white/3"
            }`}
          >
            <div className="flex items-center gap-3">
              {i === 0 && (
                <span className="text-amber-400 text-xs font-bold">👑</span>
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {bid.display_name}
                </p>
                <p className="text-xs text-white/40">{formatDate(bid.placed_at)}</p>
              </div>
            </div>
            <p
              className={`font-display font-bold ${
                i === 0 ? "text-brand-300" : "text-white/70"
              }`}
            >
              {formatPaise(bid.amount_paise)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
