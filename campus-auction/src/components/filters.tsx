"use client";
/**
 * src/components/filters.tsx
 *
 * Browse filters bar — category, condition, closing soon.
 * URL-driven; no internal state beyond the URL.
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CATEGORIES, CONDITIONS } from "@/lib/validation/auction";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/domain/auctions";

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
  const closingSoon = searchParams.get("closingSoon") === "1";
  const search = searchParams.get("search") ?? "";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <input
        type="search"
        placeholder="Search auctions…"
        value={search}
        onChange={(e) => update("search", e.target.value || null)}
        className="input max-w-xs text-sm py-2"
        id="filter-search"
      />

      {/* Category */}
      <select
        value={category}
        onChange={(e) => update("category", e.target.value || null)}
        className="input max-w-[160px] text-sm py-2"
        id="filter-category"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>

      {/* Condition */}
      <select
        value={condition}
        onChange={(e) => update("condition", e.target.value || null)}
        className="input max-w-[160px] text-sm py-2"
        id="filter-condition"
      >
        <option value="">All Conditions</option>
        {CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {CONDITION_LABELS[c]}
          </option>
        ))}
      </select>

      {/* Closing soon toggle */}
      <button
        onClick={() => update("closingSoon", closingSoon ? null : "1")}
        className={`btn btn-sm transition-all ${
          closingSoon
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            : "btn-secondary"
        }`}
        id="filter-closing-soon"
      >
        ⏰ Closing Soon
      </button>

      {/* Clear all */}
      {(category || condition || closingSoon || search) && (
        <button
          onClick={() => router.push(pathname)}
          className="btn btn-ghost btn-sm text-white/50 hover:text-white"
          id="filter-clear"
        >
          Clear
        </button>
      )}
    </div>
  );
}
