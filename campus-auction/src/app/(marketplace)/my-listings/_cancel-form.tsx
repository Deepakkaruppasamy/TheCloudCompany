"use client";
/**
 * src/app/(marketplace)/my-listings/_cancel-form.tsx
 *
 * Inline cancel-auction form with a reason textarea.
 */
import { useState, useTransition } from "react";
import { cancelAuction } from "@/actions/auctions";

interface CancelFormProps {
  auctionId: string;
}

export default function CancelForm({ auctionId }: CancelFormProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    startTransition(async () => {
      const result = await cancelAuction(auctionId, reason.trim());
      if (!result.ok) {
        setError(result.error);
      }
      // On success the action calls redirect() so we land on /my-listings
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-danger btn-sm">
        🗑 Cancel
      </button>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 space-y-3 w-full sm:max-w-xs">
      <label className="label text-red-300">Cancellation reason</label>
      <textarea
        className="input text-sm min-h-[80px] resize-none border-red-500/30"
        placeholder="Why are you cancelling this listing?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        disabled={isPending}
      />
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="btn btn-danger btn-sm flex-1"
        >
          {isPending ? "Cancelling…" : "Confirm Cancel"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          disabled={isPending}
          className="btn btn-ghost btn-sm"
        >
          Keep
        </button>
      </div>
    </div>
  );
}
