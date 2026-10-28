/**
 * src/app/(marketplace)/page.tsx
 *
 * Browse page — the main campus marketplace listing.
 * Server Component; reads URL search params for filtering and pagination.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { listAuctions, getPublicStats } from "@/data/auctions";
import AuctionCard from "@/components/auction-card";
import Filters from "@/components/filters";
import { CATEGORIES } from "@/lib/validation/auction";
import { CATEGORY_LABELS } from "@/domain/auctions";
import { IconShieldCheck, IconClock, IconTag, IconPlus } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Campus Marketplace — Live Auctions",
};

/** Skeleton grid shown while listings load */
function AuctionGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass flex flex-col overflow-hidden animate-pulse rounded-2xl">
          <div className="h-48 skeleton" />
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

const CATEGORY_ICONS: Record<string, string> = {
  cycle: "🚲",
  calculator: "🧮",
  books: "📚",
  electronics: "💻",
  other: "📦",
};

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
      {/* Hero Banner Section */}
      <div className="relative mb-8 rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-brand-950/40 via-[#10121d] to-surface-950 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-4">
              <IconShieldCheck className="w-3.5 h-3.5 text-brand-400" />
              <span>Campus Verified Community</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-white leading-tight">
              Bid, Buy & Sell <span className="text-gradient-brand">Within Campus</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/60 leading-relaxed max-w-xl">
              Transparent student auctions with atomic database locking, fair countdown closures, and zero fees.
            </p>

            {/* Quick Campus Feature Badges */}
            <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-white/50">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {stats.active_auctions} Active Auction{stats.active_auctions !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Zero Service Fees
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                In-Person Handover
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link
              href="/auctions/new"
              className="btn btn-primary btn-lg shadow-xl shadow-brand-900/40 text-center font-bold"
            >
              <IconPlus className="w-5 h-5" />
              <span>Start an Auction</span>
            </Link>
          </div>
        </div>

        {/* Quick Category Pills */}
        <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Link
            href="/"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
              !category
                ? "bg-white/15 border-white/25 text-white shadow-sm"
                : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            🔥 All Items
          </Link>
          {CATEGORIES.map((c) => {
            const isCatActive = category === c;
            return (
              <Link
                key={c}
                href={`/?category=${c}`}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                  isCatActive
                    ? "bg-brand-500/20 border-brand-400/40 text-brand-300 shadow-sm"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                <span>{CATEGORY_ICONS[c]}</span>
                <span>{CATEGORY_LABELS[c]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Interactive Filters Bar */}
      <Suspense
        fallback={
          <div className="glass p-4 mb-6 animate-pulse rounded-2xl">
            <div className="skeleton h-10 rounded-xl" />
          </div>
        }
      >
        <Filters />
      </Suspense>

      {/* Active Filter Query Feedback */}
      {(category || condition || search || closingSoon) && (
        <div className="flex items-center justify-between text-white/50 text-xs mb-4 px-1">
          <p>
            Showing <span className="text-white font-medium">{total}</span> auction{total !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
            {category ? ` in ${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}` : ""}
          </p>
          <Link href="/" className="text-brand-300 hover:text-brand-200 underline">
            Clear all
          </Link>
        </div>
      )}

      {/* Auction Grid */}
      <Suspense fallback={<AuctionGridSkeleton />}>
        {auctions.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center py-20 text-center px-4 rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
              🔍
            </div>
            <h2 className="text-xl font-display font-semibold text-white mb-2">
              No auctions match your search
            </h2>
            <p className="text-white/50 text-sm mb-6 max-w-sm">
              {search || category || condition || closingSoon
                ? "Try broadening your filters or clearing search terms."
                : "No items are currently listed. Be the first to create one!"}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {(search || category || condition || closingSoon) && (
                <Link href="/" className="btn btn-secondary btn-md">
                  Reset Filters
                </Link>
              )}
              <Link href="/auctions/new" className="btn btn-primary btn-md">
                + List an Item
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} serverNow={serverNow} />
            ))}
          </div>
        )}
      </Suspense>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">
              ← Previous
            </Link>
          ) : (
            <button disabled className="btn btn-secondary btn-sm opacity-30 cursor-not-allowed">
              ← Previous
            </button>
          )}

          <div className="px-4 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-white/70">
            Page <span className="text-white font-semibold">{page}</span> of {totalPages}
          </div>

          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">
              Next →
            </Link>
          ) : (
            <button disabled className="btn btn-secondary btn-sm opacity-30 cursor-not-allowed">
              Next →
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
