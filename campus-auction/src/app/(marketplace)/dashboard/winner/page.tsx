/**
 * src/app/(marketplace)/dashboard/winner/page.tsx
 *
 * Winner Dashboard — Track won listings, pickup deadlines, and confirm receipt.
 */
import { requireUser } from "@/lib/auth/session";
import { getMyWonTransactions } from "@/data/transactions";
import { getAuction } from "@/data/auctions";
import { formatPaise } from "@/domain/money";
import { formatDate } from "@/lib/time";
import Countdown from "@/components/countdown";
import StatusBadge from "@/components/status-badge";
import Link from "next/link";
import WinnerActionButtons from "./_winner-actions";
import { IconClock, IconShoppingCart, IconShieldCheck } from "@/components/ui/icons";

export const metadata = {
  title: "Won Auctions | Campus Auction",
};

export default async function WinnerDashboardPage() {
  const user = await requireUser();
  const transactions = await getMyWonTransactions(user.id);

  // Fetch auction details for each transaction
  const items = await Promise.all(
    transactions.map(async (txn) => {
      const auction = await getAuction(txn.auction_id);
      return { txn, auction };
    })
  );

  const awaitingSeller = items.filter(
    (i) => i.txn.status === "pending_seller_approval"
  );
  const activePickup = items.filter((i) => i.txn.status === "reserved");
  const pastItems = items.filter(
    (i) =>
      i.txn.status === "completed" ||
      i.txn.status === "rejected" ||
      i.txn.status === "seller_unresponsive" ||
      i.txn.status === "failed_pickup"
  );

  const serverNow = new Date().toISOString();

  return (
    <div className="page-container space-y-8">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge badge-active">Buyer Dashboard</span>
        </div>
        <h1 className="section-title">Won Items Hub</h1>
        <p className="section-subtitle">
          Track won auctions, coordinate campus pickups, and confirm item handovers
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-purple-300">
            {activePickup.length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Ready for Pickup
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-amber-300">
            {awaitingSeller.length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Awaiting Seller Response
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-bold font-display text-emerald-400">
            {pastItems.filter((i) => i.txn.status === "completed").length}
          </p>
          <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">
            Completed Purchases
          </p>
        </div>
      </div>

      {/* In Handover / Pickup */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
          <h2 className="text-lg font-bold text-white">
            Ready for Campus Pickup ({activePickup.length})
          </h2>
        </div>

        {activePickup.length === 0 ? (
          <div className="glass p-8 text-center text-white/40 text-sm rounded-2xl">
            No items are currently pending pickup.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {activePickup.map(({ txn, auction }) => (
              <div key={txn.id} className="glass p-6 space-y-4 rounded-2xl border-purple-500/40 bg-purple-500/[0.03]">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-white text-base">
                      {auction?.title ?? "Auction Item"}
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
                      <span>Meetup & Pickup Deadline:</span>
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
                    <span className="text-white/70">Your Confirmation (Buyer)</span>
                    {txn.winner_confirmed_at ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        ✓ Receipt Confirmed
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium">Pending item handover</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Seller Confirmation</span>
                    {txn.seller_confirmed_at ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        ✓ Confirmed
                      </span>
                    ) : (
                      <span className="text-white/40">Waiting for seller</span>
                    )}
                  </div>
                </div>

                <WinnerActionButtons
                  transactionId={txn.id}
                  winnerConfirmed={!!txn.winner_confirmed_at}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Awaiting Seller Approval */}
      {awaitingSeller.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">
            Awaiting Seller Decision ({awaitingSeller.length})
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {awaitingSeller.map(({ txn, auction }) => (
              <div key={txn.id} className="glass p-6 space-y-3 rounded-2xl border border-white/[0.08]">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="font-semibold text-white text-base">
                    {auction?.title ?? "Auction Item"}
                  </h3>
                  <StatusBadge status={txn.status as any} />
                </div>
                <p className="text-xs text-white/50">
                  Winning Bid:{" "}
                  <span className="text-brand-300 font-bold text-sm ml-1">
                    {formatPaise(txn.final_amount_paise)}
                  </span>
                </p>
                <div className="text-xs bg-white/[0.04] p-3 rounded-xl flex items-center justify-between border border-white/[0.08]">
                  <span className="text-white/60 flex items-center gap-1.5">
                    <IconClock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Seller Response Due:</span>
                  </span>
                  <Countdown
                    closesAt={txn.seller_response_deadline_at}
                    serverNow={serverNow}
                    className="font-bold text-white font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Purchase History */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">Past Purchases & Outcomes</h2>
        {pastItems.length === 0 ? (
          <div className="glass p-8 text-center text-white/40 text-sm rounded-2xl">
            No past purchases yet.
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl border border-white/[0.08]">
            <div className="divide-y divide-white/[0.06]">
              {pastItems.map(({ txn, auction }) => (
                <div
                  key={txn.id}
                  className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <p className="font-semibold text-white text-sm">
                      {auction?.title ?? "Auction Item"}
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
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
