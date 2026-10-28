/**
 * src/app/(marketplace)/auctions/[id]/page.tsx
 *
 * Auction detail page — shows full listing info, bid history, and bid form.
 * Server Component.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAuction, getSellerDisplayName, autoCloseIfExpired } from "@/data/auctions";
import { getBidHistory } from "@/data/bids";
import { getTransactionByAuction } from "@/data/transactions";
import { getUser } from "@/lib/auth/session";
import { getPhotoSignedUrl } from "@/actions/auctions";
import {
  isAuctionBiddable,
  isAuctionEditable,
  isAuctionCancellable,
  isClosingSoon,
  STATUS_LABELS,
  CATEGORY_LABELS,
  CONDITION_LABELS,
} from "@/domain/auctions";
import { formatPaise } from "@/domain/money";
import { formatDate, formatRelativeTime } from "@/lib/time";
import StatusBadge from "@/components/status-badge";
import Countdown from "@/components/countdown";
import BidForm from "@/components/bid-form";
import BidHistory from "@/components/bid-history";
import QuestionsSection from "@/components/questions-section";
import { getAuctionQuestions } from "@/data/questions";
import {
  IconClock,
  IconShieldCheck,
  IconTag,
  IconUser,
  IconArrowRight,
} from "@/components/ui/icons";

interface PageProps {
  params: Promise<{ id: string }>;
}

const CATEGORY_ICONS: Record<string, string> = {
  cycle: "🚲",
  calculator: "🧮",
  books: "📚",
  electronics: "💻",
  other: "📦",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const auction = await getAuction(id);
  if (!auction) return { title: "Auction Not Found" };
  return { title: `${auction.title} | Campus Auction` };
}

export default async function AuctionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const serverNow = new Date().toISOString();

  const [initialAuction, user] = await Promise.all([getAuction(id), getUser()]);

  if (!initialAuction) notFound();

  let auction = initialAuction;
  if (auction.status === "active" && new Date(auction.closes_at) <= new Date()) {
    await autoCloseIfExpired(auction.id);
    auction = (await getAuction(id)) ?? auction;
  }

  const [bids, sellerName, transaction, photoUrl, questions] = await Promise.all([
    getBidHistory(id).catch(() => []),
    getSellerDisplayName(auction.seller_id).catch(() => null),
    getTransactionByAuction(id).catch(() => null),
    auction.photo_path ? getPhotoSignedUrl(auction.photo_path).catch(() => null) : Promise.resolve(null),
    getAuctionQuestions(id).catch(() => []),
  ]);

  const now = new Date();
  const isSeller = user?.id === auction.seller_id;
  const biddable = isAuctionBiddable(auction.status, auction.opens_at, auction.closes_at, now);
  const editable = isAuctionEditable(auction.status, auction.first_bid_at, auction.closes_at, now);
  const cancellable = isAuctionCancellable(auction.status, auction.first_bid_at);
  const closingSoon = isClosingSoon(auction.closes_at, now);

  const displayPrice = auction.current_price_paise ?? auction.starting_price_paise;
  const hasActiveBid = auction.current_price_paise !== null;

  return (
    <div className="page-container max-w-6xl">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-white/50 mb-6">
        <Link href="/" className="hover:text-white transition-colors">
          Marketplace
        </Link>
        <span>/</span>
        <Link
          href={`/?category=${auction.category}`}
          className="hover:text-white transition-colors"
        >
          {CATEGORY_LABELS[auction.category as keyof typeof CATEGORY_LABELS] ?? auction.category}
        </Link>
        <span>/</span>
        <span className="text-white/80 truncate max-w-xs">{auction.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: media, description, bid history (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Media preview */}
          {photoUrl ? (
            <div className="glass overflow-hidden rounded-3xl aspect-video flex items-center justify-center border border-white/[0.08] bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={auction.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-3xl h-72 sm:h-80 flex flex-col items-center justify-center bg-gradient-to-br from-brand-950/40 via-surface-900 to-black/60 border border-white/[0.08] relative">
              <span className="text-8xl drop-shadow-xl select-none">
                {CATEGORY_ICONS[auction.category] ?? "📦"}
              </span>
              <span className="absolute bottom-4 text-xs text-white/40 font-mono tracking-wider uppercase">
                {CATEGORY_LABELS[auction.category as keyof typeof CATEGORY_LABELS]}
              </span>
            </div>
          )}

          {/* Title & Metadata */}
          <div className="glass p-6 sm:p-7 rounded-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={auction.status} closingSoon={closingSoon} />
              <span className="badge bg-white/10 text-white/80 border-white/15 text-xs">
                {CATEGORY_LABELS[auction.category as keyof typeof CATEGORY_LABELS] ?? auction.category}
              </span>
              <span className="badge bg-white/10 text-white/80 border-white/15 text-xs">
                {CONDITION_LABELS[auction.condition as keyof typeof CONDITION_LABELS] ?? auction.condition}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white leading-tight">
              {auction.title}
            </h1>

            {/* Seller profile card */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold">
                  {sellerName ? sellerName[0].toUpperCase() : "S"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white">
                      {sellerName ?? "Campus Seller"}
                    </span>
                    <IconShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-white/40">
                    Listed {formatRelativeTime(auction.created_at)}
                  </p>
                </div>
              </div>

              {isSeller && (
                <span className="px-2.5 py-1 rounded-lg bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
                  Your Listing
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="glass p-6 sm:p-7 rounded-3xl space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">
              Item Details & Condition
            </h2>
            <div className="text-white/80 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
              {auction.description}
            </div>
          </div>

          {/* Cancellation Banner */}
          {auction.status === "cancelled_by_seller" && auction.cancellation_reason && (
            <div className="alert-error rounded-2xl">
              <span className="text-xl">🚫</span>
              <div>
                <p className="font-semibold">Listing Cancelled by Seller</p>
                <p className="text-xs mt-1 opacity-90">{auction.cancellation_reason}</p>
              </div>
            </div>
          )}

          {/* Bid History */}
          <div>
            <BidHistory bids={bids} />
          </div>

          {/* Questions & Answers */}
          <div>
            <QuestionsSection
              auctionId={auction.id}
              sellerId={auction.seller_id}
              currentUserId={user?.id}
              isSeller={isSeller}
              questions={questions}
              isAuctionActive={auction.status === "active"}
            />
          </div>
        </div>

        {/* Right column: live pricing, bid form, actions (5 cols) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
          {/* Main Pricing & Countdown Card */}
          <div className="glass p-6 sm:p-7 rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#141522] to-surface-950 shadow-2xl space-y-6">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  {hasActiveBid ? "Leading Bid" : "Starting Price"}
                </span>
                {auction.status === "active" && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Accepting Bids
                  </span>
                )}
              </div>
              <p className="text-4xl font-display font-extrabold text-white tracking-tight">
                {formatPaise(displayPrice)}
              </p>
            </div>

            {/* Live Countdown if active */}
            {auction.status === "active" && (
              <div className="space-y-2">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60 text-xs font-medium">
                    <IconClock className="w-4 h-4 text-amber-400" />
                    <span>Auction closes in:</span>
                  </div>
                  <Countdown
                    closesAt={auction.closes_at}
                    serverNow={serverNow}
                    className="text-base font-bold text-white font-mono"
                  />
                </div>
                {auction.extension_count > 0 && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium animate-pulse">
                    <span>⏱️</span>
                    <span>
                      Extended {auction.extension_count} time{auction.extension_count > 1 ? "s" : ""} (+60s anti-sniping rule)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Non-active status indicator */}
            {auction.status !== "active" && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between text-sm">
                <span className="text-white/50">Auction Status:</span>
                <span className="text-white font-semibold">
                  {STATUS_LABELS[auction.status] ?? auction.status}
                </span>
              </div>
            )}

            {/* Bid Placement Form */}
            {biddable && !isSeller && user && (
              <div className="pt-2">
                <BidForm
                  auctionId={auction.id}
                  currentPricePaise={auction.current_price_paise}
                  startingPricePaise={auction.starting_price_paise}
                  minimumIncrementPaise={auction.minimum_increment_paise}
                  sellerId={auction.seller_id}
                  currentUserId={user?.id}
                />
              </div>
            )}

            {/* Unauthenticated CTA */}
            {biddable && !isSeller && !user && (
              <div className="pt-2 text-center space-y-3">
                <p className="text-white/60 text-xs">Sign in with your campus account to bid</p>
                <Link
                  href={`/sign-in?next=/auctions/${auction.id}`}
                  className="btn btn-primary btn-lg w-full font-bold"
                >
                  Sign in to Bid
                </Link>
              </div>
            )}

            {/* Seller Controls */}
            {isSeller && (editable || cancellable) && (
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  Seller Options
                </p>
                {editable && (
                  <Link
                    href={`/auctions/${auction.id}/edit`}
                    className="btn btn-secondary btn-md w-full"
                  >
                    ✏️ Edit Listing Details
                  </Link>
                )}
                {cancellable && (
                  <Link
                    href="/my-listings"
                    className="btn btn-danger btn-md w-full"
                  >
                    Cancel Listing (0 Bids)
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Transaction Outcome Card (if finalized/won) */}
          {transaction && (
            <div className="glass p-6 rounded-3xl space-y-4 border border-white/[0.08]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
                  Transaction State
                </h2>
                <StatusBadge status={transaction.status as any} />
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-white/[0.06]">
                  <span className="text-white/50">Winning Amount</span>
                  <span className="text-brand-300 font-bold text-sm">
                    {formatPaise(transaction.final_amount_paise)}
                  </span>
                </div>
                {transaction.seller_response_deadline_at && (
                  <div className="flex justify-between py-1 border-b border-white/[0.06]">
                    <span className="text-white/50">Seller Deadline</span>
                    <span className="text-white/80">
                      {formatDate(transaction.seller_response_deadline_at)}
                    </span>
                  </div>
                )}
                {transaction.pickup_deadline_at && (
                  <div className="flex justify-between py-1 border-b border-white/[0.06]">
                    <span className="text-white/50">Pickup Deadline</span>
                    <span className="text-white/80">
                      {formatDate(transaction.pickup_deadline_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auction Timeline Specifications */}
          <div className="glass p-5 rounded-3xl space-y-2.5 text-xs border border-white/[0.06]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1">
              Specifications & Guarantees
            </p>
            <div className="flex justify-between text-white/60">
              <span>Bidding opens</span>
              <span className="text-white/90">{formatDate(auction.opens_at)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Bidding closes</span>
              <span className="text-white/90">{formatDate(auction.closes_at)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Minimum bid increment</span>
              <span className="text-white/90">{formatPaise(auction.minimum_increment_paise)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Verification</span>
              <span className="text-emerald-400 font-medium">PostgreSQL Row-Locked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
