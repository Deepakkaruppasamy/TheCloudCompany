"use client";

import { useState } from "react";
import { confirmHandover } from "@/actions/transactions";

interface Props {
  transactionId: string;
  winnerConfirmed: boolean;
}

export default function WinnerActionButtons({
  transactionId,
  winnerConfirmed,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (winnerConfirmed) {
    return (
      <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 text-center font-medium">
        ✓ Handover Confirmed by You
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <button
        onClick={async () => {
          setLoading(true);
          setError(null);
          const res = await confirmHandover(transactionId);
          if (!res.ok) setError(res.error);
          setLoading(false);
        }}
        disabled={loading}
        className="btn btn-accent btn-sm w-full"
      >
        {loading ? "Confirming..." : "Confirm Item Received"}
      </button>
    </div>
  );
}
