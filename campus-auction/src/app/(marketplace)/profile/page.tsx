import { requireUser, getUserProfile } from "@/lib/auth/session";
import { getMyListings } from "@/data/auctions";
import { getMyWonTransactions, getSellerTransactions } from "@/data/transactions";
import { formatDate } from "@/lib/time";
import { formatPaise } from "@/domain/money";
import Link from "next/link";
import ProfileForm from "./_profile-form";
import { IconShieldCheck, IconTag, IconShoppingCart, IconArrowRight } from "@/components/ui/icons";

export const metadata = {
  title: "My Profile | Campus Auction",
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
  const completedPurchases = wonTransactions.filter((t) => t.status === "completed").length;

  const isSeller = profile.role === "seller";

  return (
    <div className="page-container max-w-4xl space-y-8">
      {/* Header Profile Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-white/[0.1] bg-gradient-to-br from-brand-950/40 via-surface-900 to-[#10121d]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-600 flex items-center justify-center text-3xl shadow-xl shadow-brand-950/50 border border-brand-400/30">
            {isSeller ? "🏷️" : "🛒"}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-display font-extrabold text-white">
                {profile.display_name}
              </h1>
              <span className={`badge ${isSeller ? "badge-reserved" : "badge-active"}`}>
                {isSeller ? "Seller Account" : "Buyer Account"}
              </span>
              {profile.is_verified && (
                <span className="badge bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px]">
                  <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Campus Verified</span>
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 mt-1 font-mono">
              Member since {formatDate(profile.created_at)}
            </p>
          </div>
        </div>

        {/* Action Button to their primary Dashboard */}
        <div className="w-full sm:w-auto">
          {isSeller ? (
            <Link
              href="/dashboard/seller"
              className="btn btn-primary btn-md w-full sm:w-auto font-bold flex items-center gap-2"
            >
              <span>Seller Hub</span>
              <IconArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/dashboard/winner"
              className="btn btn-primary btn-md w-full sm:w-auto font-bold flex items-center gap-2"
            >
              <span>Won Items Hub</span>
              <IconArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Activity Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass p-5 text-center rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-extrabold font-display text-white">{listings.length}</p>
          <p className="text-xs text-white/50 mt-1 uppercase tracking-wider font-medium">Listings Created</p>
        </div>
        <div className="glass p-5 text-center rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-extrabold font-display text-emerald-400">{activeListings}</p>
          <p className="text-xs text-white/50 mt-1 uppercase tracking-wider font-medium">Active Auctions</p>
        </div>
        <div className="glass p-5 text-center rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-extrabold font-display text-purple-300">{wonTransactions.length}</p>
          <p className="text-xs text-white/50 mt-1 uppercase tracking-wider font-medium">Auctions Won</p>
        </div>
        <div className="glass p-5 text-center rounded-2xl border border-white/[0.08]">
          <p className="text-2xl font-extrabold font-display text-brand-300">
            {completedSales + completedPurchases}
          </p>
          <p className="text-xs text-white/50 mt-1 uppercase tracking-wider font-medium">Handovers Done</p>
        </div>
      </div>

      {/* Profile Settings Form */}
      <div className="glass p-6 sm:p-8 space-y-6 rounded-3xl border border-white/[0.08]">
        <div>
          <h2 className="text-lg font-bold text-white font-display">Account Details & Preferences</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Update your public display name or switch your default focus between Seller and Buyer
          </p>
        </div>

        <ProfileForm profile={profile as any} email={user.email ?? ""} />
      </div>
    </div>
  );
}
