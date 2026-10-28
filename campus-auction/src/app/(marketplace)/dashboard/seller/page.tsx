/**
 * src/app/(marketplace)/dashboard/seller/page.tsx
 *
 * Seller Dashboard — Manage offers, approvals, and ongoing handovers.
 */
import { requireUser } from "@/lib/auth/session";
import { getSellerTransactions } from "@/data/transactions";
import { getMyListings } from "@/data/auctions";
import { formatPaise } from "@/domain/money";
import { formatDate } from "@/lib/time";
import Countdown from "@/components/countdown";
import StatusBadge from "@/components/status-badge";
import Link from "next/link";
import SellerActionButtons from "./_seller-actions";
import { IconClock, IconCheck, IconPlus, IconTag } from "@/components/ui/icons";

export const metadata = {
  title: "Seller Hub | Campus Auction",
};

export default async function SellerDashboardPage() {
  const user = await requireUser();
  const [transactions, listings] = await Promise.all([
    getSellerTransactions(user.id).catch(() => []),
    getMyListings(user.id).catch(() => []),
  ]);

  const pendingApproval = transactions.filter(
    (t) => t.status === "pending_seller_approval"
  );
  const reserved = transactions.filter((t) => t.status === "reserved");
  const pastTransactions = transactions.filter(
    (t) =>
      t.status === "completed" ||
      t.status === "rejected" ||
      t.status === "seller_unresponsive" ||
      t.status === "failed_pickup"
  );

  const serverNow = new Date().toISOString();

  return (
    <div className="page-container space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-reserved">Seller Dashboard</span>
          </div>
          <h1 className="section-title">Seller Hub</h1>
          <p className="section-subtitle">
            Manage offers, buyer approvals, and scheduled campus handovers
          </p>
        </div>
        <Link href="/auctions/new" className="btn btn-primary btn-md shrink-0">
          <IconPlus className="w-4 h-4" />
          <span>+ Create Listing</span>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-amber-300">
            {pendingApproval.length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Needs Approval
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-purple-300">
            {reserved.length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Active Handovers
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-emerald-400">
            {pastTransactions.filter((t) => t.status === "completed").length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Completed Sales
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-brand-300">
            {listings.filter((l) => l.status === "active").length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Live Auctions
          </p>
        </div>
      </div>

      {/* Action Required: Awaiting Decision */}
      {pendingApproval.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <h2 className="text-lg font-bold text-amber-300">
              Action Required: High Bids Awaiting Your Approval ({pendingApproval.length})
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {pendingApproval.map((txn) => {
              const auction = listings.find((a) => a.id === txn.auction_id);
              return (
                <div
                  key={txn.id}
                  className="glass p-6 space-y-4 border-amber-500/40 rounded-2xl bg-amber-500/[0.03] shadow-lg shadow-amber-950/20"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-semibold text-white text-base">
                        {auction ? auction.title : "Auction #" + txn.auction_id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-white/50 mt-1">
                        Winning Bid:{" "}
                        <span className="text-brand-300 font-extrabold text-base ml-1">
                          {formatPaise(txn.final_amount_paise)}
                        </span>
                      </p>
                    </div>
                    <StatusBadge status={txn.status as any} />
                  </div>

                  <div className="text-xs bg-white/[0.04] p-3 rounded-xl flex items-center justify-between border border-white/[0.08]">
                    <span className="text-white/60 flex items-center gap-1.5">
                      <IconClock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Response Due In:</span>
                    </span>
                    <Countdown
                      closesAt={txn.seller_response_deadline_at}
                      serverNow={serverNow}
                      className="font-bold text-amber-300 font-mono"
                    />
                  </div>

                  <SellerActionButtons transactionId={txn.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reserved (In Handover / Pickup) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">
          Active In-Person Handovers ({reserved.length})
        </h2>
        {reserved.length === 0 ? (
          <div className="glass p-8 text-center text-white/40 text-sm rounded-2xl">
            No active handovers in progress.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {reserved.map((txn) => {
              const auction = listings.find((a) => a.id === txn.auction_id);
              return (
                <div key={txn.id} className="glass p-6 space-y-4 rounded-2xl border-purple-500/30">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-semibold text-white text-base">
                        {auction ? auction.title : "Auction #" + txn.auction_id.slice(0, 8)}
                      </h3>
                      <p className="text-sm text-brand-300 font-extrabold mt-0.5">
                        {formatPaise(txn.final_amount_paise)}
                      </p>
                    </div>
                    <StatusBadge status={txn.status as any} />
                  </div>

                  {txn.pickup_deadline_at && (
                    <div className="text-xs bg-white/[0.04] p-3 rounded-xl flex items-center justify-between border border-white/[0.08]">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <IconClock className="w-3.5 h-3.5 text-purple-400" />
                        <span>Pickup Deadline:</span>
                      </span>
                      <Countdown
                        closesAt={txn.pickup_deadline_at}
                        serverNow={serverNow}
                        className="font-bold text-white font-mono"
                      />
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-2">
                    <p className="font-semibold uppercase tracking-wider text-white/40 text-[10px]">
                      Two-Party Confirmation Status
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-white/70">Your Confirmation (Seller)</span>
                      {txn.seller_confirmed_at ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          ✓ Confirmed
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Pending click below</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/70">Buyer Confirmation</span>
                      {txn.winner_confirmed_at ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          ✓ Confirmed
                        </span>
                      ) : (
                        <span className="text-white/40">Waiting for buyer</span>
                      )}
                    </div>
                  </div>

                  <SellerActionButtons
                    transactionId={txn.id}
                    isReserved={true}
                    sellerConfirmed={!!txn.seller_confirmed_at}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Transactions */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">Completed & Past Orders</h2>
        {pastTransactions.length === 0 ? (
          <div className="glass p-8 text-center text-white/40 text-sm rounded-2xl">
            No completed sales yet.
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl border border-white/[0.08]">
            <div className="divide-y divide-white/[0.06]">
              {pastTransactions.map((txn) => {
                const auction = listings.find((a) => a.id === txn.auction_id);
                return (
                  <div
                    key={txn.id}
                    className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:bg-white/[0.02] transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {auction?.title ?? "Auction #" + txn.auction_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {formatDate(txn.created_at)}
                        {txn.outcome_reason && ` • ${txn.outcome_reason}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-brand-300 font-bold text-sm font-mono">
                        {formatPaise(txn.final_amount_paise)}
                      </span>
                      <StatusBadge status={txn.status as any} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
