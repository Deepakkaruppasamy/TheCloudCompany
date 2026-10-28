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
import { IconClock } from "./ui/icons";

type Auction = Database["public"]["Tables"]["auctions"]["Row"];

interface AuctionCardProps {
  auction: Auction;
  serverNow?: string;
  photoUrl?: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  cycle: "🚲",
  calculator: "🧮",
  books: "📚",
  electronics: "💻",
  other: "📦",
};

export default function AuctionCard({ auction, serverNow, photoUrl }: AuctionCardProps) {
  const closingSoon = isClosingSoon(auction.closes_at);
  const displayPrice = auction.current_price_paise ?? auction.starting_price_paise;
  const hasActiveBid = auction.current_price_paise !== null;

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="auction-card group flex flex-col justify-between"
      id={`auction-card-${auction.id}`}
    >
      {/* Top Banner / Image Area */}
      <div className="relative h-48 bg-gradient-to-br from-brand-950/70 via-surface-900 to-black/60 overflow-hidden flex items-center justify-center border-b border-white/[0.06]">
        {photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt={auction.title}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="transform group-hover:scale-110 transition-transform duration-500 ease-out select-none">
            <span className="text-6xl drop-shadow-lg opacity-60 group-hover:opacity-90 transition-opacity">
              {CATEGORY_ICONS[auction.category] ?? "📦"}
            </span>
          </div>
        )}

        {/* Ambient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e15] via-transparent to-black/30 pointer-events-none" />

        {/* Badges on Top Corners */}
        <div className="absolute top-3 left-3 z-10">
          <StatusBadge status={auction.status} closingSoon={closingSoon} />
        </div>

        <div className="absolute top-3 right-3 z-10">
          <span className="badge bg-black/50 text-white/80 border-white/10 backdrop-blur-md text-[11px] font-medium">
            {CATEGORY_LABELS[auction.category as keyof typeof CATEGORY_LABELS] ?? auction.category}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {CONDITION_LABELS[auction.condition as keyof typeof CONDITION_LABELS] ?? auction.condition}
            </span>
          </div>
          <h3 className="font-display font-semibold text-white text-base leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
            {auction.title}
          </h3>
        </div>

        {/* Pricing & Countdown Footer */}
        <div className="pt-3.5 border-t border-white/[0.08] flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-0.5">
              {hasActiveBid ? "Current Bid" : "Starting Price"}
            </p>
            <p className="text-xl font-display font-extrabold text-white tracking-tight group-hover:text-brand-200 transition-colors">
              {formatPaise(displayPrice)}
            </p>
          </div>

          {auction.status === "active" && (
            <div className="text-right flex flex-col items-end">
              <div className="flex items-center gap-1 text-[11px] font-medium text-white/40 mb-0.5">
                <IconClock className="w-3 h-3" />
                <span>Ends in</span>
              </div>
              <Countdown
                closesAt={auction.closes_at}
                serverNow={serverNow}
                className="text-xs font-semibold text-white/90 font-mono"
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
