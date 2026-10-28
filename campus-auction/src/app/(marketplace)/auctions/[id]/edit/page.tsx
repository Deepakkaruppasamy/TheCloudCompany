/**
 * src/app/(marketplace)/auctions/[id]/edit/page.tsx
 *
 * Edit auction page — pre-fills AuctionForm with existing data.
 * Server Component that fetches data, then delegates to a client wrapper
 * for success-redirect handling.
 */
import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getAuction } from "@/data/auctions";
import { isAuctionEditable } from "@/domain/auctions";
import EditAuctionClient from "./_edit-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAuctionPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const auction = await getAuction(id);

  if (!auction) notFound();

  // Only the seller can edit
  if (auction.seller_id !== user.id) {
    redirect(`/auctions/${id}`);
  }

  const editable = isAuctionEditable(
    auction.status,
    auction.first_bid_at,
    auction.closes_at
  );

  if (!editable) {
    redirect(`/auctions/${id}`);
  }

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-8">
        <h1 className="section-title">Edit Listing</h1>
        <p className="section-subtitle mt-1">
          Update your auction details. You can only edit before the first bid is placed.
        </p>
      </div>

      <div className="glass p-8">
        <EditAuctionClient
          auctionId={auction.id}
          defaultValues={{
            auctionId: auction.id,
            title: auction.title,
            description: auction.description,
            category: auction.category,
            condition: auction.condition,
            photoPath: auction.photo_path,
          }}
        />
      </div>
    </div>
  );
}
