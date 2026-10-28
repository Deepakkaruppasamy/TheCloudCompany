"use client";
/**
 * src/components/bid-form.tsx
 *
 * Bid placement form with quick-increment buttons and idempotency protection.
 */
import { useActionState, useId, useMemo, useState } from "react";
import { placeBid, type BidResult } from "@/actions/bids";
import { formatPaise, minimumBidPaise, rupeesToPaise } from "@/domain/money";
import { IconCheck, IconCrown } from "./ui/icons";

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
  // Idempotency key generated once per render, reused on retries
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [result, formAction, isPending] = useActionState<BidResult | null, FormData>(
    placeBid,
    null
  );

  const minPaise = minimumBidPaise(currentPricePaise, startingPricePaise, minimumIncrementPaise);
  const minRupees = minPaise / 100;

  const [rupees, setRupees] = useState(String(minRupees));

  if (currentUserId === sellerId) {
    return (
      <div className="alert-info rounded-xl">
        <span className="text-base">🏷️</span>
        <div>
          <p className="font-semibold text-xs uppercase tracking-wider text-indigo-300">Seller Note</p>
          <p className="text-xs text-white/70 mt-0.5">
            You are the owner of this auction. Sellers cannot bid on their own listings.
          </p>
        </div>
      </div>
    );
  }

  // Quick increment handler
  const handleQuickAdd = (extraRupees: number) => {
    const base = parseFloat(rupees) || minRupees;
    const target = Math.max(minRupees, base + extraRupees);
    setRupees(String(target));
  };

  const parsedRupees = parseFloat(rupees);
  const isBelowMin = !isNaN(parsedRupees) && parsedRupees < minRupees;

  return (
    <form action={formAction} id={`bid-form-${auctionId}`} className="space-y-4">
      <input type="hidden" name="auctionId" value={auctionId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={`${formId}-amount`} className="label mb-0">
            Bid Amount (₹)
          </label>
          <span className="text-xs font-medium text-brand-300">
            Min: {formatPaise(minPaise)}
          </span>
        </div>

        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 font-semibold text-base">
            ₹
          </span>
          <input
            id={`${formId}-amount`}
            type="number"
            name="amountRupees"
            min={minRupees}
            step="1"
            value={rupees}
            onChange={(e) => setRupees(e.target.value)}
            placeholder={`Min ₹${minRupees}`}
            className={`input pl-8 text-lg font-bold ${
              (result && !result.ok) || isBelowMin ? "input-error" : ""
            }`}
            required
            disabled={isPending}
          />
        </div>

        {/* Quick increment buttons */}
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[11px] font-semibold text-white/40 uppercase">Add:</span>
          {[50, 100, 200, 500].map((inc) => (
            <button
              key={inc}
              type="button"
              onClick={() => handleQuickAdd(inc)}
              className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white/80 hover:text-white transition-all"
            >
              +₹{inc}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRupees(String(minRupees))}
            className="px-2 py-1 rounded-lg bg-transparent text-[11px] text-white/40 hover:text-white ml-auto"
          >
            Reset
          </button>
        </div>

        {/* Convert rupees to paise for the server action */}
        <input
          type="hidden"
          name="amountPaise"
          value={rupees ? String(rupeesToPaise(parseFloat(rupees))) : ""}
        />
      </div>

      {isBelowMin && (
        <p className="text-xs text-amber-400">
          ⚠️ Your bid must be at least ₹{minRupees.toFixed(2)}.
        </p>
      )}

      {result && !result.ok && (
        <div className="alert-error animate-slide-down">
          <span>⚠️</span>
          <div>
            <p className="font-medium">{result.error}</p>
            {result.minRequired && (
              <p className="text-xs mt-1 text-red-300/80">
                Minimum required bid is {formatPaise(result.minRequired)}.
              </p>
            )}
          </div>
        </div>
      )}

      {result?.ok && (
        <div className="alert-success animate-slide-down">
          <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p>
            {result.data.replayed
              ? "Your bid was already processed and recorded."
              : "Bid placed successfully! You are currently the highest bidder."}
          </p>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-accent btn-lg w-full shadow-lg text-white font-bold tracking-wide"
        disabled={isPending || !rupees || isBelowMin}
        id={`place-bid-btn-${auctionId}`}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Securing bid…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span>Place Bid</span>
            {rupees && <span>· ₹{rupees}</span>}
          </span>
        )}
      </button>
    </form>
  );
}
