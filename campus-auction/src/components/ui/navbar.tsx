"use client";
/**
 * src/components/ui/navbar.tsx
 *
 * Top navigation bar with user state and notification badge.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavBarProps {
  user: User | null;
}

export default function NavBar({ user }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/sign-in";
  };

  const userRole = user?.user_metadata?.role;
  const isSeller = userRole === "seller";

  const navLinks = user
    ? [
        { href: "/", label: "Browse" },
        ...(isSeller
          ? [
              { href: "/my-listings", label: "My Listings" },
              { href: "/dashboard/seller", label: "Seller Dashboard" },
            ]
          : [{ href: "/dashboard/winner", label: "Won Items" }]),
        { href: "/notifications", label: "Notifications" },
        { href: "/profile", label: "Profile" },
      ]
    : [];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-surface-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-display font-bold text-xl text-white hover:text-brand-300 transition-colors"
          >
            <span className="text-2xl">🏛️</span>
            <span>Campus Auction</span>
          </Link>

          {/* Nav links */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-brand-500/20 text-brand-300"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                >
                  <span>{isSeller ? "🏷️" : "🛒"}</span>
                  <span className="font-medium">
                    {user.user_metadata?.display_name || user.email?.split("@")[0]}
                  </span>
                </Link>
                {isSeller && (
                  <Link
                    href="/auctions/new"
                    className="btn btn-primary btn-sm hidden md:flex"
                  >
                    + List Item
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="btn btn-ghost btn-sm"
                  id="sign-out-btn"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/sign-up" className="btn btn-primary btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
