"use client";
/**
 * src/components/ui/navbar.tsx
 *
 * Top navigation bar with user state, role badges, and quick actions.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  IconPlus,
  IconTag,
  IconShoppingCart,
  IconBell,
  IconUser,
  IconShieldCheck,
} from "./icons";

export interface NavUser {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
}

interface NavBarProps {
  user: NavUser | null;
}

export default function NavBar({ user }: NavBarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/sign-in";
  };

  const isSeller = user?.role === "seller";
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  const navLinks = user
    ? [
        { href: "/", label: "Browse" },
        ...(isSeller
          ? [
              { href: "/my-listings", label: "My Listings" },
              { href: "/dashboard/seller", label: "Seller Hub" },
            ]
          : [{ href: "/dashboard/winner", label: "Won Items" }]),
        { href: "/notifications", label: "Notifications" },
      ]
    : [{ href: "/", label: "Browse" }];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0b0c10]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display font-bold text-lg text-white group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-900/50 group-hover:scale-105 transition-transform duration-200">
              <span className="text-lg">🏛️</span>
            </div>
            <div className="flex flex-col">
              <span className="leading-tight group-hover:text-brand-300 transition-colors">
                Campus<span className="text-brand-400">Auction</span>
              </span>
              <span className="text-[10px] text-white/40 font-mono tracking-wider uppercase font-semibold">
                Peer Marketplace
              </span>
            </div>
          </Link>

          {/* Nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-brand-500/20 text-brand-300 border border-brand-500/30 shadow-inner"
                      : "text-white/70 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Seller: Post Item Button */}
                {isSeller && (
                  <Link
                    href="/auctions/new"
                    className="btn btn-primary btn-sm hidden sm:inline-flex items-center gap-1.5"
                  >
                    <IconPlus className="w-4 h-4" />
                    <span>List Item</span>
                  </Link>
                )}

                {/* Profile Pill */}
                <Link
                  href="/profile"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    pathname === "/profile"
                      ? "bg-brand-500/20 border-brand-500/40 text-brand-200"
                      : "bg-white/[0.04] border-white/[0.1] text-white/80 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-white/10 text-xs">
                    {isSeller ? (
                      <IconTag className="w-3 h-3 text-purple-300" />
                    ) : (
                      <IconShoppingCart className="w-3 h-3 text-sky-300" />
                    )}
                  </span>
                  <span className="max-w-[100px] truncate">{displayName}</span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-white/10 text-white/60">
                    {isSeller ? "Seller" : "Buyer"}
                  </span>
                </Link>

                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="btn btn-ghost btn-sm text-xs text-white/50 hover:text-white"
                  id="sign-out-btn"
                  title="Sign out"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="btn btn-ghost btn-sm text-sm"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="btn btn-primary btn-sm text-sm"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile menu trigger */}
            {user && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-white/70 hover:text-white bg-white/5 border border-white/10"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {user && mobileMenuOpen && (
          <div className="md:hidden py-3 px-2 border-t border-white/[0.08] space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-xl text-sm font-medium ${
                  pathname === link.href
                    ? "bg-brand-500/20 text-brand-300"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isSeller && (
              <Link
                href="/auctions/new"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-medium text-emerald-400 hover:bg-white/5"
              >
                + List an Item
              </Link>
            )}
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5"
            >
              Profile Settings
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
