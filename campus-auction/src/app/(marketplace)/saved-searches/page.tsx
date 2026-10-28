/**
 * src/app/(marketplace)/saved-searches/page.tsx
 *
 * Saved searches & alerts management page.
 * Server Component with client manager.
 */
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getSavedSearches } from "@/data/saved-searches";
import SavedSearchesManager from "./saved-searches-manager";

export const metadata: Metadata = {
  title: "Saved Searches & Alerts | Campus Auction",
  description: "Get real-time notifications when items matching your search criteria are listed.",
};

export default async function SavedSearchesPage() {
  await requireUser();
  const searches = await getSavedSearches();

  return (
    <div className="page-container max-w-5xl space-y-8">
      <div>
        <h1 className="section-title">Saved Searches & Alerts</h1>
        <p className="section-subtitle">
          Never miss an item. Save your searches and receive instant alerts when students list what you need.
        </p>
      </div>

      <SavedSearchesManager initialSearches={searches} />
    </div>
  );
}

