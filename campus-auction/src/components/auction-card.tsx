/**
 * src/components/auction-card.tsx
 *
 * Presentational auction card for the browse grid.
 */
import Link from "next/link";
import type { Database } from "@/types/database";
import { formatPaise } from "@/domain/money";
import { isClosingSoon, CATEGORY_LABELS, CONDITION_LABELS } from "@/domain/auctions";
import StatusBadge from "@/components/status-badge";
import Countdown from "@/components/countdown";

type Auction = Database["public"]["Tables"]["auctions"]["Row"];

interface AuctionCardProps {
  auction: Auction;
  serverNow?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  cycle: "🚲",
  calculator: "🧮",
  books: "📚",
  electronics: "💻",
  other: "📦",
};

export default function AuctionCard({ auction, serverNow }: AuctionCardProps) {
  const closingSoon = isClosingSoon(auction.closes_at);
  const displayPrice = auction.current_price_paise ?? auction.starting_price_paise;
  const hasActiveBid = auction.current_price_paise !== null;

  return (
    <Link href={`/auctions/${auction.id}`} className="auction-card group" id={`auction-card-${auction.id}`}>
      {/* Photo placeholder / image */}
      <div className="relative h-44 bg-gradient-to-br from-brand-900/60 to-surface-900 overflow-hidden flex items-center justify-center">
        <span className="text-6xl opacity-40 group-hover:opacity-60 transition-opacity duration-300">
          {CATEGORY_ICONS[auction.category] ?? "📦"}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-900/80 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <StatusBadge status={auction.status} closingSoon={closingSoon} />
        </div>
        <div className="absolute top-3 right-3">
          <span className="badge bg-white/10 text-white/60 ring-1 ring-white/20 text-xs">
            {CATEGORY_LABELS[auction.category as keyof typeof CATEGORY_LABELS] ?? auction.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-white text-base line-clamp-2 mb-1 group-hover:text-brand-200 transition-colors">
          {auction.title}
        </h3>
        <p className="text-white/40 text-xs mb-3">
          {CONDITION_LABELS[auction.condition as keyof typeof CONDITION_LABELS] ?? auction.condition}
        </p>

        <div className="flex items-end justify-between mt-auto pt-4 border-t border-white/10">
          <div>
            <p className="text-xs text-white/40 mb-0.5">
              {hasActiveBid ? "Current bid" : "Starting at"}
            </p>
            <p className="text-lg font-display font-bold text-brand-300">
              {formatPaise(displayPrice)}
            </p>
          </div>
          {auction.status === "active" && (
            <div className="text-right">
              <p className="text-xs text-white/40 mb-0.5">Closes in</p>
              <Countdown closesAt={auction.closes_at} serverNow={serverNow} className="text-sm font-semibold" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
