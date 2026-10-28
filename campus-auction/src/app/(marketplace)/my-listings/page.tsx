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

export const metadata: Metadata = {
  title: "My Listings",
};

export default async function MyListingsPage() {
  const user = await requireUser();
  const listings = await getMyListings(user.id);

  const now = new Date();

  return (
    <div className="page-container max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title">My Listings</h1>
          <p className="section-subtitle mt-1">
            {listings.length} listing{listings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/auctions/new" className="btn btn-primary btn-md shrink-0">
          + New Listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📦</span>
          <h2 className="text-xl font-display font-semibold text-white mb-2">No listings yet</h2>
          <p className="text-white/50 text-sm mb-6">
            Start selling by creating your first auction listing.
          </p>
          <Link href="/auctions/new" className="btn btn-primary btn-md">
            Create Listing
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

            return (
              <div key={listing.id} className="glass p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xl">
                    {listing.category === "cycle"
                      ? "🚲"
                      : listing.category === "calculator"
                      ? "🧮"
                      : listing.category === "books"
                      ? "📚"
                      : listing.category === "electronics"
                      ? "💻"
                      : "📦"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <StatusBadge status={listing.status} />
                      <span className="badge bg-white/10 text-white/50 ring-1 ring-white/15 text-xs">
                        {CATEGORY_LABELS[listing.category as keyof typeof CATEGORY_LABELS] ?? listing.category}
                      </span>
                      <span className="badge bg-white/10 text-white/50 ring-1 ring-white/15 text-xs">
                        {CONDITION_LABELS[listing.condition as keyof typeof CONDITION_LABELS] ?? listing.condition}
                      </span>
                    </div>
                    <Link
                      href={`/auctions/${listing.id}`}
                      className="text-white font-semibold hover:text-brand-300 transition-colors line-clamp-1"
                    >
                      {listing.title}
                    </Link>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-white/40">
                      <span>
                        {listing.current_price_paise ? "Current bid" : "Starting"}{" "}
                        <span className="text-brand-400 font-semibold">
                          {formatPaise(displayPrice)}
                        </span>
                      </span>
                      <span>Closes {formatDate(listing.closes_at)}</span>
                      <span>Listed {formatRelativeTime(listing.created_at)}</span>
                    </div>

                    {listing.cancellation_reason && (
                      <p className="text-red-400/70 text-xs mt-2">
                        Cancelled: {listing.cancellation_reason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 sm:items-end shrink-0">
                    <Link
                      href={`/auctions/${listing.id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      View →
                    </Link>
                    {editable && (
                      <Link
                        href={`/auctions/${listing.id}/edit`}
                        className="btn btn-secondary btn-sm"
                      >
                        ✏️ Edit
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
