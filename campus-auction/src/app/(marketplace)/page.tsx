/**
 * src/app/(marketplace)/page.tsx
 *
 * Browse page — the main marketplace listing.
 * Server Component; reads URL search params for filtering and pagination.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { listAuctions, getPublicStats } from "@/data/auctions";
import AuctionCard from "@/components/auction-card";
import Filters from "@/components/filters";

export const metadata: Metadata = {
  title: "Browse Auctions",
};

/** Skeleton grid shown while Filters + listings load */
function AuctionGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass flex flex-col overflow-hidden animate-pulse">
          <div className="h-44 skeleton" />
          <div className="p-5 space-y-3">
            <div className="skeleton h-4 rounded w-3/4" />
            <div className="skeleton h-3 rounded w-1/2" />
            <div className="skeleton h-6 rounded w-1/3 mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;

  const category = typeof params.category === "string" ? params.category : undefined;
  const condition = typeof params.condition === "string" ? params.condition : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const closingSoon = params.closingSoon === "true";
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);

  const pageSize = 12;
  const serverNow = new Date().toISOString();

  const [{ auctions, total }, stats] = await Promise.all([
    listAuctions({ category, condition, search, closingSoon }, page, pageSize),
    getPublicStats().catch(() => ({ active_auctions: 0 })),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  // Build pagination href helper
  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (category) sp.set("category", category);
    if (condition) sp.set("condition", condition);
    if (search) sp.set("search", search);
    if (closingSoon) sp.set("closingSoon", "true");
    sp.set("page", String(p));
    return `/?${sp.toString()}`;
  }

  return (
    <div className="page-container">
      {/* Hero banner */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="section-title">Campus Marketplace</h1>
            <p className="section-subtitle mt-1">
              {stats.active_auctions > 0
                ? `${stats.active_auctions} active auction${stats.active_auctions !== 1 ? "s" : ""} right now`
                : "No active auctions right now — check back soon!"}
            </p>
          </div>
          <Link href="/auctions/new" className="btn btn-primary btn-md shrink-0">
            + List an Item
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Suspense
        fallback={
          <div className="glass p-4 mb-6 animate-pulse">
            <div className="skeleton h-10 rounded-xl" />
          </div>
        }
      >
        <Filters />
      </Suspense>

      {/* Results summary */}
      {(category || condition || search || closingSoon) && (
        <p className="text-white/40 text-sm mb-5">
          {total} result{total !== 1 ? "s" : ""}
          {search ? ` for "${search}"` : ""}
        </p>
      )}

      {/* Auction grid */}
      <Suspense fallback={<AuctionGridSkeleton />}>
        {auctions.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <h2 className="text-xl font-display font-semibold text-white mb-2">No auctions found</h2>
            <p className="text-white/50 text-sm mb-6 max-w-sm">
              {search || category || condition
                ? "Try adjusting or clearing your filters."
                : "Be the first to list something for sale!"}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {(search || category || condition || closingSoon) && (
                <Link href="/" className="btn btn-ghost btn-md">
                  Clear filters
                </Link>
              )}
              <Link href="/auctions/new" className="btn btn-primary btn-md">
                List an Item
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} serverNow={serverNow} />
            ))}
          </div>
        )}
      </Suspense>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">
              ← Previous
            </Link>
          )}

          <span className="text-white/50 text-sm px-3">
            Page {page} of {totalPages}
          </span>

          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
