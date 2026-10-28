"use client";

import { useState } from "react";
import { approveAuction, rejectAuction, confirmHandover } from "@/actions/transactions";

interface Props {
  transactionId: string;
  isReserved?: boolean;
  sellerConfirmed?: boolean;
}

export default function SellerActionButtons({
  transactionId,
  isReserved,
  sellerConfirmed,
}: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isReserved) {
    if (sellerConfirmed) {
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
          {loading ? "Confirming..." : "Confirm Handover Completed"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!rejecting ? (
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setLoading(true);
              setError(null);
              const res = await approveAuction(transactionId);
              if (!res.ok) setError(res.error);
              setLoading(false);
            }}
            disabled={loading}
            className="btn btn-primary btn-sm flex-1"
          >
            {loading ? "Approving..." : "Approve Sale"}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={loading}
            className="btn btn-danger btn-sm"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
          <label className="text-xs text-red-300 font-medium block">
            Reason for Rejection *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Item damaged during storage..."
            className="input text-xs min-h-16 py-2"
            maxLength={300}
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!reason.trim()) {
                  setError("Please provide a reason.");
                  return;
                }
                setLoading(true);
                setError(null);
                const res = await rejectAuction(transactionId, reason);
                if (!res.ok) setError(res.error);
                setLoading(false);
              }}
              disabled={loading || !reason.trim()}
              className="btn btn-danger btn-sm flex-1"
            >
              {loading ? "Rejecting..." : "Confirm Rejection"}
            </button>
            <button
              onClick={() => {
                setRejecting(false);
                setError(null);
              }}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
