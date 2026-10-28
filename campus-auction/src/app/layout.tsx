import type { Metadata } from "next";
import "./globals.css";
import { getUser } from "@/lib/auth/session";
import NavBar from "@/components/ui/navbar";
import { IconShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: {
    template: "%s | Campus Auction",
    default: "Campus Auction — Transparent Peer-to-Peer Campus Marketplace",
  },
  description:
    "The trusted campus auction platform for students. List items, bid transparently, and complete secure in-person handovers — built with PostgreSQL row-level locks and fair atomic closures.",
  keywords: ["campus", "auction", "marketplace", "student", "buy", "sell", "college"],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <NavBar user={user} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/[0.08] mt-20 py-10 bg-[#090a0f]/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <div className="flex items-center gap-2">
              <span className="text-base">🏛️</span>
              <span className="text-white/70 font-semibold font-display">Campus Auction</span>
              <span>— Decentralized Student Commerce</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-emerald-400">
                <IconShieldCheck className="w-3.5 h-3.5" />
                <span>Atomic DB Locks</span>
              </span>
              <span>•</span>
              <span>All auctions final upon handover</span>
              <span>•</span>
              <span>© {new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
