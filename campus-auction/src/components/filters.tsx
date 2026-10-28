"use client";
/**
 * src/components/filters.tsx
 *
 * Browse filters bar — search, category, condition, closing soon.
 * Fully URL-driven.
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CATEGORIES, CONDITIONS } from "@/lib/validation/auction";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/domain/auctions";
import { IconSearch, IconFire, IconFilter, IconX } from "./ui/icons";

export default function Filters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  const category = searchParams.get("category") ?? "";
  const condition = searchParams.get("condition") ?? "";
  const closingSoon = searchParams.get("closingSoon") === "true";
  const search = searchParams.get("search") ?? "";

  const hasFilters = Boolean(category || condition || closingSoon || search);

  return (
    <div className="glass p-3 sm:p-4 mb-8">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input with icon */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
            <IconSearch className="w-4 h-4" />
          </div>
          <input
            type="search"
            placeholder="Search items by name, model, specs…"
            value={search}
            onChange={(e) => update("search", e.target.value || null)}
            className="input pl-10 pr-4 py-2 text-sm w-full bg-black/20"
            id="filter-search"
          />
          {search && (
            <button
              onClick={() => update("search", null)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdowns & toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Select */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <select
              value={category}
              onChange={(e) => update("category", e.target.value || null)}
              className="input text-xs sm:text-sm py-2 px-3 appearance-none bg-black/20 cursor-pointer pr-8"
              id="filter-category"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-surface-900 text-white">
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/40">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Condition Select */}
          <div className="relative min-w-[130px] flex-1 sm:flex-initial">
            <select
              value={condition}
              onChange={(e) => update("condition", e.target.value || null)}
              className="input text-xs sm:text-sm py-2 px-3 appearance-none bg-black/20 cursor-pointer pr-8"
              id="filter-condition"
            >
              <option value="">All Conditions</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c} className="bg-surface-900 text-white">
                  {CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/40">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Closing Soon Filter */}
          <button
            type="button"
            onClick={() => update("closingSoon", closingSoon ? null : "true")}
            className={`btn btn-sm transition-all flex items-center gap-1.5 py-2 px-3 ${
              closingSoon
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/30"
                : "btn-secondary text-white/70"
            }`}
            id="filter-closing-soon"
          >
            <IconFire className={`w-3.5 h-3.5 ${closingSoon ? "text-amber-400" : "text-white/40"}`} />
            <span>Ending Soon</span>
          </button>

          {/* Reset Filters */}
          {hasFilters && (
            <button
              onClick={() => router.push(pathname)}
              className="btn btn-ghost btn-sm text-xs text-white/50 hover:text-white flex items-center gap-1"
              id="filter-clear"
            >
              <IconX className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
