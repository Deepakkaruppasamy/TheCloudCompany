/**
 * src/app/(marketplace)/my-listings/page.tsx
 *
 * My Listings page — shows the current user's auction listings.
 * Server Component.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getMyListings } from "@/data/auctions";
import { getPhotoSignedUrls } from "@/actions/auctions";
import {
  isAuctionCancellable,
  isAuctionEditable,
  STATUS_LABELS,
  CATEGORY_LABELS,
  CONDITION_LABELS,
} from "@/domain/auctions";
import { formatPaise } from "@/domain/money";
import { formatDate, formatRelativeTime } from "@/lib/time";
import StatusBadge from "@/components/status-badge";
import CancelForm from "./_cancel-form";
import { IconPlus, IconClock, IconTag } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "My Listings | Campus Auction",
};

const CATEGORY_ICONS: Record<string, string> = {
  cycle: "🚲",
  calculator: "🧮",
  books: "📚",
  electronics: "💻",
  other: "📦",
};

export default async function MyListingsPage() {
  const user = await requireUser();
  const listings = await getMyListings(user.id).catch(() => []);
  const photoPaths = listings.map((l) => l.photo_path).filter(Boolean) as string[];
  const photoUrls: Record<string, string> = await getPhotoSignedUrls(photoPaths).catch(() => ({}));

  const now = new Date();

  return (
    <div className="page-container max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title">My Listings</h1>
          <p className="section-subtitle">
            Manage your campus auction listings, track bids, and edit zero-bid items
          </p>
        </div>
        <Link href="/auctions/new" className="btn btn-primary btn-md shrink-0">
          <IconPlus className="w-4 h-4" />
          <span>+ New Listing</span>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-white/[0.08]">
          <span className="text-5xl mb-4 opacity-50">📦</span>
          <h2 className="text-xl font-display font-bold text-white mb-2">No listings created yet</h2>
          <p className="text-white/50 text-sm mb-6 max-w-sm">
            Ready to declutter? List your cycle, books, or electronics for auction.
          </p>
          <Link href="/auctions/new" className="btn btn-primary btn-md font-bold">
            Create First Listing
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const editable = isAuctionEditable(
              listing.status,
              listing.first_bid_at,
              listing.closes_at,
              now
            );
            const cancellable = isAuctionCancellable(listing.status, listing.first_bid_at);
            const displayPrice = listing.current_price_paise ?? listing.starting_price_paise;
            const hasBids = listing.current_price_paise !== null;

            return (
              <div
                key={listing.id}
                className="glass p-5 sm:p-6 rounded-2xl border border-white/[0.08] hover:border-white/[0.15] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Category Icon / Photo */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl shadow-inner overflow-hidden">
                    {listing.photo_path && photoUrls[listing.photo_path] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photoUrls[listing.photo_path]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      CATEGORY_ICONS[listing.category] ?? "📦"
                    )}
                  </div>

                  {/* Info Column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <StatusBadge status={listing.status} />
                      <span className="badge bg-white/5 text-white/60 border-white/10 text-xs">
                        {CATEGORY_LABELS[listing.category as keyof typeof CATEGORY_LABELS] ?? listing.category}
                      </span>
                      <span className="badge bg-white/5 text-white/60 border-white/10 text-xs">
                        {CONDITION_LABELS[listing.condition as keyof typeof CONDITION_LABELS] ?? listing.condition}
                      </span>
                    </div>

                    <Link
                      href={`/auctions/${listing.id}`}
                      className="text-white font-bold text-base hover:text-brand-300 transition-colors line-clamp-1"
                    >
                      {listing.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-white/50">
                      <span>
                        {hasBids ? "Current Highest Bid:" : "Starting Price:"}{" "}
                        <span className="text-brand-300 font-bold ml-1 font-mono text-sm">
                          {formatPaise(displayPrice)}
                        </span>
                      </span>
                      <span>Closes: {formatDate(listing.closes_at)}</span>
                      <span>Listed: {formatRelativeTime(listing.created_at)}</span>
                    </div>

                    {listing.cancellation_reason && (
                      <p className="text-red-400 text-xs mt-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                        Cancelled reason: {listing.cancellation_reason}
                      </p>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex sm:flex-col gap-2 shrink-0 sm:items-end mt-2 sm:mt-0">
                    <Link
                      href={`/auctions/${listing.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View Auction →
                    </Link>
                    {editable && (
                      <Link
                        href={`/auctions/${listing.id}/edit`}
                        className="btn btn-ghost btn-sm text-xs"
                      >
                        ✏️ Edit Details
                      </Link>
                    )}
                    {cancellable && (
                      <CancelForm auctionId={listing.id} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
