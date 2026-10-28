import { requireUser, getUserProfile } from "@/lib/auth/session";
import { getMyListings } from "@/data/auctions";
import { getMyWonTransactions, getSellerTransactions } from "@/data/transactions";
import { formatDate } from "@/lib/time";
import { formatPaise } from "@/domain/money";
import Link from "next/link";
import ProfileForm from "./_profile-form";

export const metadata = {
  title: "My Profile",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getUserProfile();

  if (!profile) {
    return (
      <div className="page-container py-12 text-center text-white/50">
        Profile not found.
      </div>
    );
  }

  // Fetch relevant activity counts
  const [listings, wonTransactions, sellerTransactions] = await Promise.all([
    getMyListings(user.id),
    getMyWonTransactions(user.id),
    getSellerTransactions(user.id),
  ]);

  const activeListings = listings.filter((l) => l.status === "active").length;
  const completedSales = sellerTransactions.filter((t) => t.status === "completed").length;
  const activeWon = wonTransactions.filter((t) => t.status === "reserved").length;
  const completedPurchases = wonTransactions.filter((t) => t.status === "completed").length;

  const isSeller = profile.role === "seller";

  return (
    <div className="page-container max-w-4xl space-y-8">
      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-500 flex items-center justify-center text-3xl shadow-lg shadow-brand-900/40">
            {isSeller ? "🏷️" : "🛒"}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-white">
                {profile.display_name}
              </h1>
              <span className={`badge ${isSeller ? "badge-reserved" : "badge-active"}`}>
                {isSeller ? "Seller Account" : "Buyer Account"}
              </span>
              {profile.is_verified && (
                <span className="badge bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40">
                  ✓ Verified Campus Account
                </span>
              )}
            </div>
            <p className="text-sm text-white/50 mt-1">
              Member since {formatDate(profile.created_at)}
            </p>
          </div>
        </div>

        {/* Action Button to their primary Dashboard */}
        <div className="flex gap-2.5 w-full sm:w-auto">
          {isSeller ? (
            <Link
              href="/dashboard/seller"
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Go to Seller Dashboard →
            </Link>
          ) : (
            <Link
              href="/dashboard/winner"
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Go to Won Items Dashboard →
            </Link>
          )}
        </div>
      </div>

      {/* Activity Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold font-display text-brand-300">{listings.length}</p>
          <p className="text-xs text-white/50 mt-1">Total Listed</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold font-display text-emerald-400">{activeListings}</p>
          <p className="text-xs text-white/50 mt-1">Active Auctions</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold font-display text-purple-400">{wonTransactions.length}</p>
          <p className="text-xs text-white/50 mt-1">Auctions Won</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold font-display text-accent-400">
            {completedSales + completedPurchases}
          </p>
          <p className="text-xs text-white/50 mt-1">Handovers Done</p>
        </div>
      </div>

      {/* Profile Settings Form */}
      <div className="glass p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Account Details & Preferences</h2>
          <p className="text-sm text-white/50">
            Update your public display name or toggle between seller and buyer focus
          </p>
        </div>

        <ProfileForm profile={profile as any} email={user.email ?? ""} />
      </div>
    </div>
  );
}
