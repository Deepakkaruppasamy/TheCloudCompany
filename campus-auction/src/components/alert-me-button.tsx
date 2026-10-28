"use client";

import { useState } from "react";
import { createSavedSearchAction } from "@/actions/saved-searches";

interface AlertMeButtonProps {
  keyword?: string;
  category?: string;
  className?: string;
}

export default function AlertMeButton({
  keyword,
  category,
  className = "",
}: AlertMeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(
    keyword ? `Alert: ${keyword}` : category ? `Alert: ${category}` : "Campus Alert"
  );
  const [searchKeyword, setSearchKeyword] = useState(keyword || category || "");
  const [maxPrice, setMaxPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return;

    setIsSaving(true);
    setStatus("idle");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("name", name.trim() || `Alert: ${searchKeyword}`);
    fd.append("keyword", searchKeyword.trim());
    if (category) fd.append("category", category);
    if (maxPrice) fd.append("maxPrice", maxPrice);

    const res = await createSavedSearchAction(null, fd);
    setIsSaving(false);

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(res.error);
    } else {
      setStatus("success");
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
      }, 2000);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-500/15 border border-brand-500/30 text-brand-300 hover:bg-brand-500/25 hover:text-white transition-all ${className}`}
      >
        <span>🔔</span>
        <span>Alert me on similar items</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-md p-6 rounded-3xl border border-white/[0.12] bg-[#141522] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔔</span> Never Miss a Match
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/60">
              Get an instant notification whenever an auction matching this keyword or budget is published.
            </p>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">
                  Alert Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">
                  Keyword
                </label>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full text-xs bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">
                  Max Budget (₹ Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full text-xs bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {status === "error" && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  {errorMsg}
                </div>
              )}

              {status === "success" && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  ✓ Alert saved! You will receive notifications when matching items appear.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || status === "success"}
                  className="btn btn-primary btn-sm text-xs font-semibold px-4"
                >
                  {isSaving ? "Saving..." : "Save Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

