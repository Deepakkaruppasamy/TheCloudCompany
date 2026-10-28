"use client";
/**
 * src/components/auction-form.tsx
 *
 * Modern auction create/edit form component with quick duration presets
 * and robust rupee-to-paise conversion.
 */
import { useActionState, useState, useEffect } from "react";
import { CATEGORIES, CONDITIONS } from "@/lib/validation/auction";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/domain/auctions";
import type { ActionResult } from "@/actions/auctions";
import ImageUpload from "@/components/image-upload";
import { IconClock } from "./ui/icons";

interface AuctionFormProps {
  action: (prev: ActionResult<any> | null, form: FormData) => Promise<ActionResult<any>>;
  defaultValues?: {
    auctionId?: string;
    title?: string;
    description?: string;
    category?: string;
    condition?: string;
    startingPricePaise?: number;
    minimumIncrementPaise?: number;
    opensAt?: string;
    closesAt?: string;
    photoPath?: string | null;
  };
  mode?: "create" | "edit";
  onSuccess?: (data: { id?: string }) => void;
}

export default function AuctionForm({
  action,
  defaultValues = {},
  mode = "create",
}: AuctionFormProps) {
  const [result, formAction, isPending] = useActionState<ActionResult<any> | null, FormData>(
    action,
    null
  );

  const isEdit = mode === "edit";

  // Controlled states for prices and dates to ensure rock-solid conversion
  const [startPriceRupees, setStartPriceRupees] = useState(
    defaultValues.startingPricePaise ? String(defaultValues.startingPricePaise / 100) : "100"
  );
  const [minIncrementRupees, setMinIncrementRupees] = useState(
    defaultValues.minimumIncrementPaise ? String(defaultValues.minimumIncrementPaise / 100) : "10"
  );

  // Helper function to format date to HTML datetime-local (YYYY-MM-DDTHH:mm)
  function formatForInput(date: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const [opensAt, setOpensAt] = useState(() => {
    if (defaultValues.opensAt) return defaultValues.opensAt.slice(0, 16);
    return formatForInput(new Date());
  });

  const [closesAt, setClosesAt] = useState(() => {
    if (defaultValues.closesAt) return defaultValues.closesAt.slice(0, 16);
    const future = new Date(Date.now() + 24 * 3600 * 1000);
    return formatForInput(future);
  });

  // Quick duration helper
  const setDurationHours = (hours: number) => {
    const base = opensAt ? new Date(opensAt) : new Date();
    const close = new Date(base.getTime() + hours * 3600 * 1000);
    setClosesAt(formatForInput(close));
  };

  const [photoPath, setPhotoPath] = useState<string | null>(defaultValues.photoPath ?? null);

  const calculatedStartPaise = Math.round((parseFloat(startPriceRupees) || 0) * 100);
  const calculatedIncrementPaise = Math.round((parseFloat(minIncrementRupees) || 0) * 100);

  return (
    <form action={formAction} className="space-y-6" id={`auction-form-${mode}`}>
      {defaultValues.auctionId && (
        <input type="hidden" name="auctionId" value={defaultValues.auctionId} />
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label htmlFor="auction-title" className="label">
            Listing Title *
          </label>
          <input
            id="auction-title"
            type="text"
            name="title"
            defaultValue={defaultValues.title}
            placeholder="e.g. Hero Sprint 26T Mountain Bicycle, like new"
            className="input text-base font-medium"
            minLength={3}
            maxLength={120}
            required
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="auction-description" className="label">
            Description & Campus Pickup Details *
          </label>
          <textarea
            id="auction-description"
            name="description"
            defaultValue={defaultValues.description}
            placeholder="Include condition, semester used, accessories included, and where on campus you prefer meeting for handover (e.g. Library foyer, Hostel 4 lobby)..."
            className="input min-h-32 resize-y text-sm leading-relaxed"
            minLength={10}
            maxLength={2000}
            required
            disabled={isPending}
          />
        </div>
      </div>

      {/* Category & Condition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="auction-category" className="label">
            Category *
          </label>
          <select
            id="auction-category"
            name="category"
            defaultValue={defaultValues.category ?? ""}
            className="input cursor-pointer"
            required
            disabled={isPending}
          >
            <option value="" disabled>Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-surface-900 text-white">
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="auction-condition" className="label">
            Condition *
          </label>
          <select
            id="auction-condition"
            name="condition"
            defaultValue={defaultValues.condition ?? ""}
            className="input cursor-pointer"
            required
            disabled={isPending}
          >
            <option value="" disabled>Select item condition</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c} className="bg-surface-900 text-white">
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Image / Photo Upload */}
      <ImageUpload
        defaultPath={defaultValues.photoPath}
        onPhotoUploaded={setPhotoPath}
        disabled={isPending}
      />

      {/* Pricing Fields (Only in Create Mode) */}
      {!isEdit && (
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
            Pricing (₹)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="auction-start-price" className="label">
                Starting Bid (₹) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 font-semibold">
                  ₹
                </span>
                <input
                  id="auction-start-price"
                  type="number"
                  name="startingPriceRupees"
                  min={1}
                  step={1}
                  value={startPriceRupees}
                  onChange={(e) => setStartPriceRupees(e.target.value)}
                  placeholder="e.g. 500"
                  className="input pl-8 font-semibold"
                  required
                  disabled={isPending}
                />
              </div>
              <input type="hidden" name="startingPricePaise" value={calculatedStartPaise} />
            </div>

            <div>
              <label htmlFor="auction-increment" className="label">
                Minimum Increment (₹) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 font-semibold">
                  ₹
                </span>
                <input
                  id="auction-increment"
                  type="number"
                  name="minimumIncrementRupees"
                  min={1}
                  step={1}
                  value={minIncrementRupees}
                  onChange={(e) => setMinIncrementRupees(e.target.value)}
                  placeholder="e.g. 20"
                  className="input pl-8 font-semibold"
                  required
                  disabled={isPending}
                />
              </div>
              <input type="hidden" name="minimumIncrementPaise" value={calculatedIncrementPaise} />
            </div>
          </div>
        </div>
      )}

      {/* Schedule Fields (Only in Create Mode) */}
      {!isEdit && (
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
              Auction Schedule
            </h3>
            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-white/40 mr-1">Duration:</span>
              {[
                { label: "12h", hours: 12 },
                { label: "24h", hours: 24 },
                { label: "3 days", hours: 72 },
                { label: "7 days", hours: 168 },
              ].map((p) => (
                <button
                  key={p.hours}
                  type="button"
                  onClick={() => setDurationHours(p.hours)}
                  className="px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[11px] font-medium text-white/80 hover:text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="auction-opens-at" className="label">
                Opens At *
              </label>
              <input
                id="auction-opens-at"
                type="datetime-local"
                name="opensAt"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="input cursor-pointer"
                required
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="auction-closes-at" className="label">
                Closes At *
              </label>
              <input
                id="auction-closes-at"
                type="datetime-local"
                name="closesAt"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="input cursor-pointer"
                required
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="alert-error animate-slide-down">
          <span>⚠️</span>
          <p>{result.error}</p>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg w-full font-bold shadow-xl shadow-brand-900/40"
        disabled={isPending}
        id={`auction-submit-${mode}`}
      >
        {isPending
          ? isEdit ? "Updating auction…" : "Publishing auction…"
          : isEdit ? "Save Changes" : "Publish Auction Listing"}
      </button>
    </form>
  );
}
