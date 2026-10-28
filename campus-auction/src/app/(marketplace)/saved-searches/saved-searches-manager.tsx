"use client";

import { useState } from "react";
import type { SavedSearchRow } from "@/data/saved-searches";
import {
  createSavedSearchAction,
  deleteSavedSearchAction,
  toggleSavedSearchAction,
} from "@/actions/saved-searches";
import { formatPaise } from "@/domain/money";
import { formatRelativeTime } from "@/lib/time";
import { ValidCategories } from "@/lib/validation/saved-searches";
import { CATEGORY_LABELS } from "@/domain/auctions";
import { IconTag, IconClock, IconPlus } from "@/components/ui/icons";

interface SavedSearchesManagerProps {
  initialSearches: SavedSearchRow[];
}

export default function SavedSearchesManager({
  initialSearches,
}: SavedSearchesManagerProps) {
  const [searches, setSearches] = useState(initialSearches);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formMaxPrice, setFormMaxPrice] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const activeCount = searches.filter((s) => s.is_active).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formName.trim() || !formKeyword.trim()) {
      setError("Please provide both an alert name and a keyword.");
      return;
    }

    setIsCreating(true);
    const fd = new FormData();
    fd.append("name", formName.trim());
    fd.append("keyword", formKeyword.trim());
    if (formCategory) fd.append("category", formCategory);
    if (formMaxPrice) fd.append("maxPrice", formMaxPrice);

    const res = await createSavedSearchAction(null, fd);
    setIsCreating(false);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(`Alert "${formName}" created! We will notify you when matching items are listed.`);
      setFormName("");
      setFormKeyword("");
      setFormCategory("");
      setFormMaxPrice("");
      // Add optimistic / refresh
      setSearches([
        {
          id: res.data,
          user_id: "",
          name: formName.trim(),
          keyword: formKeyword.trim(),
          category: formCategory || null,
          max_price_paise: formMaxPrice ? Math.round(parseFloat(formMaxPrice) * 100) : null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...searches,
      ]);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    setLoadingId(id);
    setError(null);

    const res = await toggleSavedSearchAction(id, !currentActive);
    setLoadingId(null);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !currentActive } : s))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    setLoadingId(id);
    setError(null);

    const res = await deleteSavedSearchAction(id);
    setLoadingId(null);

    if (!res.ok) {
      setError(res.error);
    } else {
      setSearches((prev) => prev.filter((s) => s.id !== id));
      setSuccess("Alert removed.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Active Counter Header */}
      <div className="glass p-6 rounded-3xl border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔔</span> Active Search Alerts
          </h2>
          <p className="text-xs text-white/50 mt-1">
            We monitor campus listings 24/7 and notify you instantly when items match your criteria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <span className="text-brand-300 font-bold">{activeCount}</span>
            <span className="text-white/40"> / 10 active alerts</span>
          </div>
        </div>
      </div>

      {/* Creation Form */}
      <form
        onSubmit={handleCreate}
        className="glass p-6 rounded-3xl border border-white/[0.08] space-y-4"
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
          Create New Alert
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Alert Name *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Geared Cycle"
              className="w-full text-sm bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Keyword to Match *
            </label>
            <input
              type="text"
              value={formKeyword}
              onChange={(e) => setFormKeyword(e.target.value)}
              placeholder="e.g. cycle, hercules, roadeo"
              className="w-full text-sm bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Category (Optional)
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full text-sm bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500/50"
            >
              <option value="">Any Category</option>
              {ValidCategories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Max Budget (₹ Optional)
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={formMaxPrice}
              onChange={(e) => setFormMaxPrice(e.target.value)}
              placeholder="e.g. 2500"
              className="w-full text-sm bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-white/40">
            Matches are notified via real-time web notifications and in-app bell.
          </p>
          <button
            type="submit"
            disabled={isCreating || activeCount >= 10}
            className="btn btn-primary btn-md font-semibold text-xs px-5"
          >
            {isCreating ? "Saving..." : "+ Save Alert"}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            {success}
          </div>
        )}
      </form>

      {/* List of Saved Searches */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
          Your Saved Alerts ({searches.length})
        </h3>

        {searches.length === 0 ? (
          <div className="glass p-12 text-center rounded-3xl border border-white/[0.08] space-y-3">
            <span className="text-4xl block">🔍</span>
            <h4 className="text-base font-semibold text-white">No saved searches yet</h4>
            <p className="text-xs text-white/50 max-w-md mx-auto">
              Looking for a specific calculator, textbook, or cycle? Save a search above or click
              &ldquo;Alert me&rdquo; on search results to get notified the second someone lists it.
            </p>
          </div>
        ) : (
          searches.map((s) => (
            <div
              key={s.id}
              className={`glass p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                s.is_active
                  ? "border-white/[0.08] bg-white/[0.02]"
                  : "border-white/[0.04] bg-white/[0.01] opacity-60"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{s.name}</h4>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      s.is_active
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {s.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                  <span>
                    Keyword: <code className="text-brand-300 font-semibold">{s.keyword}</code>
                  </span>
                  {s.category && (
                    <>
                      <span>•</span>
                      <span>Category: {CATEGORY_LABELS[s.category as keyof typeof CATEGORY_LABELS] ?? s.category}</span>
                    </>
                  )}
                  {s.max_price_paise && (
                    <>
                      <span>•</span>
                      <span>Budget: ≤ {formatPaise(s.max_price_paise)}</span>
                    </>
                  )}
                  <span>•</span>
                  <span className="text-white/40">{formatRelativeTime(s.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  disabled={loadingId === s.id}
                  onClick={() => handleToggle(s.id, s.is_active)}
                  className={`btn btn-sm text-xs font-semibold px-3 py-1.5 ${
                    s.is_active ? "btn-secondary" : "btn-primary"
                  }`}
                >
                  {loadingId === s.id
                    ? "Updating..."
                    : s.is_active
                    ? "Pause Alert"
                    : "Resume Alert"}
                </button>
                <button
                  type="button"
                  disabled={loadingId === s.id}
                  onClick={() => handleDelete(s.id)}
                  className="btn btn-ghost btn-sm text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
