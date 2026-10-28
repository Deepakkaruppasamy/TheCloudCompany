"use client";
/**
 * src/components/bid-form.tsx
 *
 * Bid placement form with manual bidding, automatic proxy bidding, and quick-increment buttons.
 */
import { useActionState, useId, useMemo, useState } from "react";
import { placeBid, setAutoBidAction, type BidResult } from "@/actions/bids";
import { formatPaise, minimumBidPaise, rupeesToPaise } from "@/domain/money";
import { IconCheck, IconCrown } from "./ui/icons";

interface BidFormProps {
  auctionId: string;
  currentPricePaise: number | null;
  startingPricePaise: number;
  minimumIncrementPaise: number;
  sellerId: string;
  currentUserId?: string;
  initialAutoBidMaxPaise?: number | null;
}

export default function BidForm({
  auctionId,
  currentPricePaise,
  startingPricePaise,
  minimumIncrementPaise,
  sellerId,
  currentUserId,
  initialAutoBidMaxPaise,
}: BidFormProps) {
  const formId = useId();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [tab, setTab] = useState<"manual" | "auto">("manual");

  // Manual bid state
  const [result, formAction, isPending] = useActionState<BidResult | null, FormData>(
    placeBid,
    null
  );

  // Auto bid state
  const [autoRupees, setAutoRupees] = useState<string>(
    initialAutoBidMaxPaise ? String(initialAutoBidMaxPaise / 100) : ""
  );
  const [autoResult, setAutoResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isAutoPending, setIsAutoPending] = useState(false);

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

  const handleQuickAdd = (extraRupees: number) => {
    const base = parseFloat(rupees) || minRupees;
    const target = Math.max(minRupees, base + extraRupees);
    setRupees(String(target));
  };

  const isBelowMin = parseFloat(rupees) < minRupees;
  const isAutoBelowMin = parseFloat(autoRupees) < minRupees;

  const handleAutoBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutoResult(null);
    setIsAutoPending(true);

    const fd = new FormData();
    fd.append("auctionId", auctionId);
    fd.append("maxRupees", autoRupees);

    const res = await setAutoBidAction(null, fd);
    setIsAutoPending(false);

    if (res.ok) {
      setAutoResult({
        ok: true,
        message: `Auto-bid active! Maximum set to ₹${autoRupees}. The app will bid for you automatically.`,
      });
    } else {
      setAutoResult({ ok: false, message: res.error });
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`py-2 rounded-xl transition-all ${
            tab === "manual"
              ? "bg-brand-600 text-white shadow-md shadow-brand-900/40"
              : "text-white/50 hover:text-white"
          }`}
        >
          Direct Bid
        </button>
        <button
          type="button"
          onClick={() => setTab("auto")}
          className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            tab === "auto"
              ? "bg-brand-600 text-white shadow-md shadow-brand-900/40"
              : "text-white/50 hover:text-white"
          }`}
        >
          <span>🤖</span>
          <span>Auto Proxy Bid</span>
        </button>
      </div>

      {tab === "manual" ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="auctionId" value={auctionId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor={`${formId}-amount`} className="text-xs font-medium text-white/70">
                Bid Amount (INR)
              </label>
              <span className="text-xs text-white/50">
                Min: <span className="text-white/80 font-mono font-medium">₹{minRupees.toFixed(2)}</span>
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-mono text-base">
                ₹
              </span>
              <input
                id={`${formId}-amount`}
                type="number"
                name="amountRupees"
                min={minRupees}
                step="any"
                value={rupees}
                onChange={(e) => setRupees(e.target.value)}
                placeholder={String(minRupees)}
                className="w-full text-base font-mono font-semibold bg-black/40 border border-white/10 rounded-2xl pl-8 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-brand-500/50"
                required
              />
            </div>

            {/* Quick add chips */}
            <div className="flex gap-2 mt-2.5">
              {[50, 100, 200, 500].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleQuickAdd(inc)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
                >
                  +{inc}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRupees(String(minRupees))}
                className="px-2.5 py-1.5 text-xs text-white/40 hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>

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
                <p className="font-medium text-xs">{result.error}</p>
                {result.minRequired && (
                  <p className="text-xs mt-1 text-red-300/80">
                    Minimum required bid is {formatPaise(result.minRequired)}.
                  </p>
                )}
              </div>
            </div>
          )}

          {result?.ok && (
            <div className="alert-success animate-slide-down text-xs">
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
      ) : (
        /* Automatic Proxy Bidding Tab */
        <form onSubmit={handleAutoBidSubmit} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-brand-500/[0.06] border border-brand-500/20 text-xs text-white/70 space-y-1.5">
            <p className="font-semibold text-brand-300 flex items-center gap-1.5">
              <span>🛡️</span> Private Maximum Protection
            </p>
            <p className="text-[11px] leading-relaxed">
              Set your maximum willing budget. The app bids automatically on your behalf only when outbid, keeping you in the lead up to your limit. Your ceiling remains 100% private.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Your Maximum Budget (Ceiling)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-mono text-base">
                ₹
              </span>
              <input
                type="number"
                min={minRupees}
                step="any"
                value={autoRupees}
                onChange={(e) => setAutoRupees(e.target.value)}
                placeholder={`e.g. ${(minRupees * 1.5).toFixed(0)}`}
                className="w-full text-base font-mono font-semibold bg-black/40 border border-white/10 rounded-2xl pl-8 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-brand-500/50"
                required
              />
            </div>
            <p className="text-[11px] text-white/40 mt-1">
              Minimum allowed: ₹{minRupees.toFixed(2)}
            </p>
          </div>

          {isAutoBelowMin && autoRupees && (
            <p className="text-xs text-amber-400">
              ⚠️ Maximum must be at least the current minimum ₹{minRupees.toFixed(2)}.
            </p>
          )}

          {autoResult && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                autoResult.ok
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}
            >
              {autoResult.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isAutoPending || !autoRupees || isAutoBelowMin}
            className="btn btn-primary btn-lg w-full font-bold shadow-lg shadow-brand-900/40 text-xs"
          >
            {isAutoPending ? "Activating Auto-Bid…" : "Activate Automatic Bidding"}
          </button>
        </form>
      )}
    </div>
  );
}
