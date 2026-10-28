/**
 * src/components/bid-history.tsx
 *
 * Shows the bid history for an auction using the bid_history view.
 * Bidder ID is never exposed — only display name, amount, and time.
 */
import type { Database } from "@/types/database";
import { formatPaise } from "@/domain/money";
import { formatDate } from "@/lib/time";
import { IconCrown } from "./ui/icons";

type BidHistoryRow = Database["public"]["Views"]["bid_history"]["Row"];

interface BidHistoryProps {
  bids: BidHistoryRow[];
}

export default function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <div className="glass p-8 text-center rounded-2xl">
        <span className="text-3xl block mb-2 opacity-50">🏷️</span>
        <p className="text-white font-medium text-sm">No bids placed yet</p>
        <p className="text-white/40 text-xs mt-1">Be the first to place a bid on this item!</p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl border border-white/[0.08]">
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
        <h3 className="font-display font-semibold text-white text-sm">
          Active Bids
        </h3>
        <span className="badge bg-white/10 text-white/70 text-[11px]">
          {bids.length} total
        </span>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {bids.map((bid, i) => {
          const isHighest = i === 0;
          return (
            <div
              key={`${bid.placed_at}-${i}`}
              className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
                isHighest ? "bg-amber-500/[0.08]" : "hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                {isHighest ? (
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <IconCrown className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/40 text-xs font-mono">
                    #{i + 1}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isHighest ? "text-amber-200" : "text-white"}`}>
                      {bid.display_name}
                    </p>
                    {isHighest && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-1.5 py-0.2 rounded bg-amber-400/10 border border-amber-400/30">
                        Highest Bidder
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{formatDate(bid.placed_at)}</p>
                </div>
              </div>

              <div className="text-right">
                <p
                  className={`font-display font-bold text-base ${
                    isHighest ? "text-amber-300" : "text-white/80"
                  }`}
                >
                  {formatPaise(bid.amount_paise)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
