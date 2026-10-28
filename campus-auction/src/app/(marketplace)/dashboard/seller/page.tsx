import { requireUser } from "@/lib/auth/session";
import { getSellerTransactions } from "@/data/transactions";
import { getMyListings } from "@/data/auctions";
import { formatPaise } from "@/domain/money";
import { formatDate } from "@/lib/time";
import Countdown from "@/components/countdown";
import StatusBadge from "@/components/status-badge";
import Link from "next/link";
import SellerActionButtons from "./_seller-actions";

export const metadata = {
  title: "Seller Dashboard",
};

export default async function SellerDashboardPage() {
  const user = await requireUser();
  const [transactions, listings] = await Promise.all([
    getSellerTransactions(user.id),
    getMyListings(user.id),
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
      <div>
        <h1 className="section-title">Seller Dashboard</h1>
        <p className="section-subtitle">
          Manage offers, approvals, and ongoing handovers
        </p>
      </div>

      {/* Action Required: Awaiting Decision */}
      {pendingApproval.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h2 className="text-lg font-semibold text-amber-300">
              Action Required: Awaiting Your Approval ({pendingApproval.length})
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {pendingApproval.map((txn) => {
              const auction = listings.find((a) => a.id === txn.auction_id);
              return (
                <div
                  key={txn.id}
                  className="glass p-6 space-y-4 border-amber-500/30"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-white">
                        {auction ? auction.title : "Auction #" + txn.auction_id.slice(0, 8)}
                      </h3>
                      <p className="text-sm text-white/50">
                        Winning Bid:{" "}
                        <span className="text-brand-300 font-bold">
                          {formatPaise(txn.final_amount_paise)}
                        </span>
                      </p>
                    </div>
                    <StatusBadge status={txn.status as any} />
                  </div>

                  <div className="text-sm bg-white/5 p-3 rounded-xl flex items-center justify-between">
                    <span className="text-white/60">Response Deadline:</span>
                    <Countdown
                      closesAt={txn.seller_response_deadline_at}
                      serverNow={serverNow}
                    />
                  </div>

                  <SellerActionButtons transactionId={txn.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reserved (In Pickup / Handover) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Active Handovers ({reserved.length})
        </h2>
        {reserved.length === 0 ? (
          <div className="glass p-6 text-center text-white/40 text-sm">
            No active handovers in progress.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reserved.map((txn) => {
              const auction = listings.find((a) => a.id === txn.auction_id);
              return (
                <div key={txn.id} className="glass p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-white">
                        {auction ? auction.title : "Auction #" + txn.auction_id.slice(0, 8)}
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
                      {txn.seller_confirmed_at ? (
                        <span className="text-emerald-400">✓ Confirmed</span>
                      ) : (
                        <span className="text-amber-400">Pending your confirmation</span>
                      )}
                    </p>
                    <p>
                      Winner Confirmation:{" "}
                      {txn.winner_confirmed_at ? (
                        <span className="text-emerald-400">✓ Confirmed</span>
                      ) : (
                        <span className="text-white/40">Waiting for winner</span>
                      )}
                    </p>
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
        <h2 className="text-lg font-semibold text-white">Past Orders</h2>
        {pastTransactions.length === 0 ? (
          <div className="glass p-6 text-center text-white/40 text-sm">
            No past orders.
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="divide-y divide-white/5">
              {pastTransactions.map((txn) => {
                const auction = listings.find((a) => a.id === txn.auction_id);
                return (
                  <div
                    key={txn.id}
                    className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {auction?.title ?? "Auction #" + txn.auction_id.slice(0, 8)}
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
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
