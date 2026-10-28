import type { Metadata } from "next";
import "./globals.css";
import { getUser } from "@/lib/auth/session";
import NavBar from "@/components/ui/navbar";

export const metadata: Metadata = {
  title: {
    template: "%s | Campus Auction",
    default: "Campus Auction — Buy & Sell on Campus",
  },
  description:
    "The trusted campus marketplace for students. List items, bid competitively, and complete secure transactions — all within your campus community.",
  keywords: ["campus", "auction", "marketplace", "student", "buy", "sell"],
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
      <body>
        <NavBar user={user} />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t border-white/10 mt-16 py-8 text-center text-white/30 text-sm">
          <p>© {new Date().getFullYear()} Campus Auction. All transactions are final once completed.</p>
        </footer>
      </body>
    </html>
  );
}
