import { requireUser } from "@/lib/auth/session";
import { getMyWonTransactions } from "@/data/transactions";
import { getAuction } from "@/data/auctions";
import { formatPaise } from "@/domain/money";
import { formatDate } from "@/lib/time";
import Countdown from "@/components/countdown";
import StatusBadge from "@/components/status-badge";
import Link from "next/link";
import WinnerActionButtons from "./_winner-actions";

export const metadata = {
  title: "Won Auctions",
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
      <div>
        <h1 className="section-title">Won Auctions</h1>
        <p className="section-subtitle">
          Track won listings, pickup deadlines, and confirm receipt
        </p>
      </div>

      {/* In Handover / Pickup */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Ready for Pickup ({activePickup.length})
        </h2>
        {activePickup.length === 0 ? (
          <div className="glass p-6 text-center text-white/40 text-sm">
            No items currently ready for pickup.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activePickup.map(({ txn, auction }) => (
              <div key={txn.id} className="glass p-6 space-y-4 border-purple-500/30">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white">
                      {auction?.title ?? "Auction Item"}
                    </h3>
                    <p className="text-sm text-brand-300 font-bold">
                      {formatPaise(txn.final_amount_paise)}
                    </p>
                  </div>
                  <StatusBadge status={txn.status as any} />
                </div>

                {txn.pickup_deadline_at && (
                  <div className="text-sm bg-white/5 p-3 rounded-xl flex items-center justify-between">
                    <span className="text-white/60">Pickup Deadline:</span>
                    <Countdown
                      closesAt={txn.pickup_deadline_at}
                      serverNow={serverNow}
                    />
                  </div>
                )}

                <div className="text-xs text-white/60 space-y-1">
                  <p>
                    Your Confirmation:{" "}
                    {txn.winner_confirmed_at ? (
                      <span className="text-emerald-400">✓ Confirmed</span>
                    ) : (
                      <span className="text-amber-400">Pending your confirmation</span>
                    )}
                  </p>
                  <p>
                    Seller Confirmation:{" "}
                    {txn.seller_confirmed_at ? (
                      <span className="text-emerald-400">✓ Confirmed</span>
                    ) : (
                      <span className="text-white/40">Waiting for seller</span>
                    )}
                  </p>
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
          <h2 className="text-lg font-semibold text-white">
            Awaiting Seller Decision ({awaitingSeller.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {awaitingSeller.map(({ txn, auction }) => (
              <div key={txn.id} className="glass p-6 space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-white">
                    {auction?.title ?? "Auction Item"}
                  </h3>
                  <StatusBadge status={txn.status as any} />
                </div>
                <p className="text-sm text-white/50">
                  Winning Bid:{" "}
                  <span className="text-brand-300 font-bold">
                    {formatPaise(txn.final_amount_paise)}
                  </span>
                </p>
                <div className="text-sm bg-white/5 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-white/60">Seller Response Due:</span>
                  <Countdown
                    closesAt={txn.seller_response_deadline_at}
                    serverNow={serverNow}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Purchase History</h2>
        {pastItems.length === 0 ? (
          <div className="glass p-6 text-center text-white/40 text-sm">
            No past purchases.
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="divide-y divide-white/5">
              {pastItems.map(({ txn, auction }) => (
                <div
                  key={txn.id}
                  className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                >
                  <div>
                    <p className="font-medium text-white">
                      {auction?.title ?? "Auction Item"}
                    </p>
                    <p className="text-xs text-white/40">
                      {formatDate(txn.created_at)}
                      {txn.outcome_reason && ` • ${txn.outcome_reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-brand-300 font-semibold text-sm">
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
