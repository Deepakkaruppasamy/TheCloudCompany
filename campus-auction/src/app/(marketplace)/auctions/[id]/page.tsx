/**
 * src/app/(marketplace)/auctions/[id]/page.tsx
 *
 * Auction detail page — shows full listing info, bid history, and bid form.
 * Server Component.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAuction, getSellerDisplayName } from "@/data/auctions";
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const auction = await getAuction(id);
  if (!auction) return { title: "Auction Not Found" };
  return { title: auction.title };
}

export default async function AuctionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const serverNow = new Date().toISOString();

  const [auction, user] = await Promise.all([getAuction(id), getUser()]);

  if (!auction) notFound();

  const [bids, sellerName, transaction, photoUrl] = await Promise.all([
    getBidHistory(id),
    getSellerDisplayName(auction.seller_id),
    getTransactionByAuction(id),
    auction.photo_path ? getPhotoSignedUrl(auction.photo_path) : Promise.resolve(null),
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
    <div className="page-container max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left column */}
        <div className="lg:col-span-3 space-y-6">
          {/* Photo */}
          {photoUrl ? (
            <div className="glass overflow-hidden rounded-2xl aspect-video flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={auction.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-2xl h-64 flex items-center justify-center">
              <span className="text-8xl opacity-30">
                {auction.category === "cycle"
                  ? "🚲"
                  : auction.category === "calculator"
                  ? "🧮"
                  : auction.category === "books"
                  ? "📚"
                  : auction.category === "electronics"
                  ? "💻"
                  : "📦"}
              </span>
            </div>
          )}

          {/* Title & badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusBadge status={auction.status} closingSoon={closingSoon} />
              <span className="badge bg-white/10 text-white/60 ring-1 ring-white/20 text-xs">
                {CATEGORY_LABELS[auction.category as keyof typeof CATEGORY_LABELS] ?? auction.category}
              </span>
              <span className="badge bg-white/10 text-white/60 ring-1 ring-white/20 text-xs">
                {CONDITION_LABELS[auction.condition as keyof typeof CONDITION_LABELS] ?? auction.condition}
              </span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white leading-tight">
              {auction.title}
            </h1>
            <p className="text-white/50 text-sm mt-2">
              Listed by{" "}
              <span className="text-white/80 font-medium">{sellerName ?? "Unknown seller"}</span>
              {" · "}
              {formatRelativeTime(auction.created_at)}
            </p>
          </div>

          {/* Description */}
          <div className="glass p-6">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
              Description
            </h2>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
              {auction.description}
            </p>
          </div>

          {/* Cancellation info */}
          {auction.status === "cancelled_by_seller" && auction.cancellation_reason && (
            <div className="alert-error">
              <span>🚫</span>
              <div>
                <p className="font-medium">Cancelled by seller</p>
                <p className="mt-0.5 opacity-80">{auction.cancellation_reason}</p>
              </div>
            </div>
          )}

          {/* Bid history */}
          <div>
            <h2 className="section-title text-lg mb-4">
              Bid History{" "}
              <span className="text-white/40 text-sm font-normal ml-2">({bids.length})</span>
            </h2>
            <BidHistory bids={bids} />
          </div>
        </div>

        {/* Right column — pricing & actions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Price card */}
          <div className="glass p-6">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
              {hasActiveBid ? "Current Bid" : "Starting Price"}
            </p>
            <p className="text-4xl font-display font-bold text-brand-300 mb-4">
              {formatPaise(displayPrice)}
            </p>

            {auction.status === "active" && (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/50">Closes</span>
                  <span className="text-white/80">{formatDate(auction.closes_at)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-5">
                  <span className="text-white/50">Countdown</span>
                  <Countdown
                    closesAt={auction.closes_at}
                    serverNow={serverNow}
                    className="text-white font-semibold"
                  />
                </div>
              </>
            )}

            {auction.status !== "active" && (
              <div className="text-sm text-white/50 mb-4">
                Status: <span className="text-white/80">{STATUS_LABELS[auction.status] ?? auction.status}</span>
              </div>
            )}

            {/* Seller actions */}
            {isSeller && (editable || cancellable) && (
              <div className="border-t border-white/10 pt-4 space-y-3">
                {editable && (
                  <Link
                    href={`/auctions/${auction.id}/edit`}
                    className="btn btn-secondary btn-md w-full"
                  >
                    ✏️ Edit Listing
                  </Link>
                )}
                {cancellable && (
                  <Link
                    href={`/my-listings`}
                    className="btn btn-danger btn-md w-full"
                  >
                    Cancel Listing
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Bid form for non-sellers */}
          {biddable && !isSeller && (
            <div className="glass p-6">
              <h2 className="text-base font-display font-semibold text-white mb-4">Place a Bid</h2>
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

          {/* Must sign in to bid */}
          {biddable && !isSeller && !user && (
            <div className="glass p-6 text-center">
              <p className="text-white/60 text-sm mb-4">Sign in to place a bid</p>
              <Link
                href={`/sign-in?next=/auctions/${auction.id}`}
                className="btn btn-primary btn-md w-full"
              >
                Sign In to Bid
              </Link>
            </div>
          )}

          {/* Transaction status */}
          {transaction && (
            <div className="glass p-6 space-y-3">
              <h2 className="text-base font-display font-semibold text-white">Transaction</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Status</span>
                  <span className="text-white/80 font-medium capitalize">
                    {transaction.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Final amount</span>
                  <span className="text-brand-300 font-semibold">
                    {formatPaise(transaction.final_amount_paise)}
                  </span>
                </div>
                {transaction.seller_response_deadline_at && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Seller deadline</span>
                    <span className="text-white/80">
                      {formatDate(transaction.seller_response_deadline_at)}
                    </span>
                  </div>
                )}
                {transaction.pickup_deadline_at && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Pickup deadline</span>
                    <span className="text-white/80">
                      {formatDate(transaction.pickup_deadline_at)}
                    </span>
                  </div>
                )}
                {transaction.outcome_reason && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-white/40 text-xs">Reason: {transaction.outcome_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timing details */}
          <div className="glass p-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Opens</span>
              <span className="text-white/70">{formatDate(auction.opens_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Closes</span>
              <span className="text-white/70">{formatDate(auction.closes_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Min increment</span>
              <span className="text-white/70">{formatPaise(auction.minimum_increment_paise)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
