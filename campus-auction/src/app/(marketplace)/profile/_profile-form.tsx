"use client";

import { useState } from "react";
import { updateProfile } from "@/actions/profile";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [role, setRole] = useState<"buyer" | "seller" | "student">(
    (profile.role as any) === "seller" ? "seller" : "buyer"
  );
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    setMessage(null);

    const res = await updateProfile({
      displayName,
      role,
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } else {
      setMessage({ type: "error", text: res.error });
    }
    setIsPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-xl text-sm ${
            message.type === "success" ? "alert-success" : "alert-error"
          }`}
        >
          <span>{message.type === "success" ? "✓" : "⚠️"}</span>
          <p>{message.text}</p>
        </div>
      )}

      {/* Account Type Toggle */}
      <div>
        <label className="label">Primary Role / Account Type</label>
        <div className="grid grid-cols-2 gap-3 mt-1.5">
          <button
            type="button"
            onClick={() => setRole("buyer")}
            className={`p-4 rounded-xl border text-left transition-all ${
              role === "buyer"
                ? "bg-brand-500/20 border-brand-400 ring-2 ring-brand-500/30"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <span className="text-2xl block mb-1">🛒</span>
            <p className="font-semibold text-white">Buyer</p>
            <p className="text-xs text-white/50 mt-0.5">Focus on finding and bidding on items</p>
          </button>

          <button
            type="button"
            onClick={() => setRole("seller")}
            className={`p-4 rounded-xl border text-left transition-all ${
              role === "seller"
                ? "bg-brand-500/20 border-brand-400 ring-2 ring-brand-500/30"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <span className="text-2xl block mb-1">🏷️</span>
            <p className="font-semibold text-white">Seller</p>
            <p className="text-xs text-white/50 mt-0.5">Focus on listing auctions and managing sales</p>
          </button>
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label htmlFor="displayName" className="label">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input"
          minLength={2}
          maxLength={60}
          required
          disabled={isPending}
        />
        <p className="text-xs text-white/40 mt-1.5">
          This name is shown publicly on your listings and bids.
        </p>
      </div>

      {/* Email (Read-only) */}
      <div>
        <label className="label">Email Address (Account ID)</label>
        <input
          type="text"
          value={email}
          disabled
          className="input opacity-60 cursor-not-allowed bg-white/3"
        />
        <p className="text-xs text-white/40 mt-1.5">
          Email addresses remain strictly private and are never shown publicly to other students.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary btn-md w-full sm:w-auto"
      >
        {isPending ? "Saving..." : "Save Profile Changes"}
      </button>
    </form>
  );
}
