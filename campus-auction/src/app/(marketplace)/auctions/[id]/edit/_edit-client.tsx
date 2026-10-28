"use client";
/**
 * src/app/(marketplace)/auctions/[id]/edit/_edit-client.tsx
 *
 * Client wrapper for the edit auction form — handles success redirect.
 */
import { useRouter } from "next/navigation";
import AuctionForm from "@/components/auction-form";
import { editAuction } from "@/actions/auctions";
import type { ActionResult } from "@/actions/auctions";

interface EditAuctionClientProps {
  auctionId: string;
  defaultValues: {
    auctionId: string;
    title: string;
    description: string;
    category: string;
    condition: string;
    photoPath?: string | null;
  };
}

export default function EditAuctionClient({
  auctionId,
  defaultValues,
}: EditAuctionClientProps) {
  const router = useRouter();

  async function handleEdit(
    prevState: ActionResult | null,
    formData: FormData
  ): Promise<ActionResult> {
    const result = await editAuction(prevState, formData);
    if (result.ok) {
      router.push(`/auctions/${auctionId}`);
    }
    return result;
  }

  return (
    <AuctionForm
      action={handleEdit}
      mode="edit"
      defaultValues={defaultValues}
    />
  );
}
