"use client";
/**
 * src/components/bid-form.tsx
 *
 * Bid placement form.
 * Idempotency key is generated once per render and reused on all retries.
 */
import { useActionState, useId, useMemo } from "react";
import { placeBid, type BidResult } from "@/actions/bids";
import { formatPaise, minimumBidPaise, rupeesToPaise } from "@/domain/money";
import { useState } from "react";

interface BidFormProps {
  auctionId: string;
  currentPricePaise: number | null;
  startingPricePaise: number;
  minimumIncrementPaise: number;
  sellerId: string;
  currentUserId?: string;
}

export default function BidForm({
  auctionId,
  currentPricePaise,
  startingPricePaise,
  minimumIncrementPaise,
  sellerId,
  currentUserId,
}: BidFormProps) {
  const formId = useId();
  // idempotency key generated once per render, reused on retries
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [result, formAction, isPending] = useActionState<BidResult | null, FormData>(
    placeBid,
    null
  );
  const [rupees, setRupees] = useState("");

  if (currentUserId === sellerId) {
    return (
      <div className="alert-info">
        <span>ℹ️</span>
        <p>You are the seller of this listing and cannot place a bid.</p>
      </div>
    );
  }

  const minPaise = minimumBidPaise(currentPricePaise, startingPricePaise, minimumIncrementPaise);
  const minRupees = minPaise / 100;

  return (
    <form action={formAction} id={`bid-form-${auctionId}`} className="space-y-4">
      <input type="hidden" name="auctionId" value={auctionId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div>
        <label htmlFor={`${formId}-amount`} className="label">
          Your Bid (₹)
        </label>
        <p className="text-xs text-white/40 mb-2">
          Minimum: {formatPaise(minPaise)}
          {currentPricePaise !== null && (
            <span className="ml-2 text-white/30">
              (current + ₹{(minimumIncrementPaise / 100).toFixed(2)} increment)
            </span>
          )}
        </p>
        <input
          id={`${formId}-amount`}
          type="number"
          name="amountRupees"
          min={minRupees}
          step="0.01"
          value={rupees}
          onChange={(e) => setRupees(e.target.value)}
          placeholder={`Min ₹${minRupees.toFixed(2)}`}
          className={`input ${result && !result.ok ? "input-error" : ""}`}
          required
          disabled={isPending}
        />
        {/* Convert rupees to paise for the server action */}
        <input
          type="hidden"
          name="amountPaise"
          value={rupees ? String(rupeesToPaise(parseFloat(rupees))) : ""}
        />
      </div>

      {result && !result.ok && (
        <div className="alert-error animate-slide-down">
          <span>⚠️</span>
          <div>
            <p>{result.error}</p>
            {result.minRequired && (
              <p className="text-xs mt-1 text-red-400/70">
                Minimum required: {formatPaise(result.minRequired)}
              </p>
            )}
          </div>
        </div>
      )}

      {result?.ok && (
        <div className="alert-success animate-slide-down">
          <span>✓</span>
          <p>
            {result.data.replayed
              ? "Your bid was already recorded. No duplicate was created."
              : "Bid placed successfully! You are now the leading bidder."}
          </p>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-accent btn-lg w-full"
        disabled={isPending || !rupees}
        id={`place-bid-btn-${auctionId}`}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Placing bid…
          </span>
        ) : (
          "Place Bid"
        )}
      </button>
    </form>
  );
}
