"use client";
/**
 * src/app/(marketplace)/auctions/new/page.tsx
 *
 * Create auction page — wraps AuctionForm with client-side success redirect.
 */
import { useRouter } from "next/navigation";
import AuctionForm from "@/components/auction-form";
import { createAuction } from "@/actions/auctions";
import type { ActionResult } from "@/actions/auctions";

export default function NewAuctionPage() {
  const router = useRouter();

  async function handleCreate(
    prevState: ActionResult | null,
    formData: FormData
  ): Promise<ActionResult<{ id: string }>> {
    const result = await createAuction(prevState, formData);
    if (result.ok) {
      router.push(`/auctions/${result.data.id}`);
    }
    return result;
  }

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-8">
        <h1 className="section-title">List an Item</h1>
        <p className="section-subtitle mt-1">
          Fill in the details below to create your auction listing.
        </p>
      </div>

      <div className="glass p-8">
        <AuctionForm action={handleCreate} mode="create" />
      </div>
    </div>
  );
}
