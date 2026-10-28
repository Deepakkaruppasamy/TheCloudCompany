"use client";
/**
 * src/components/auction-form.tsx
 *
 * Shared create/edit auction form component.
 */
import { useActionState } from "react";
import { CATEGORIES, CONDITIONS } from "@/lib/validation/auction";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/domain/auctions";
import type { ActionResult } from "@/actions/auctions";

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

  return (
    <form action={formAction} className="space-y-6" id={`auction-form-${mode}`}>
      {defaultValues.auctionId && (
        <input type="hidden" name="auctionId" value={defaultValues.auctionId} />
      )}
      {defaultValues.photoPath && (
        <input type="hidden" name="photoPath" value={defaultValues.photoPath} />
      )}

      {/* Title */}
      <div>
        <label htmlFor="auction-title" className="label">Title *</label>
        <input
          id="auction-title"
          type="text"
          name="title"
          defaultValue={defaultValues.title}
          placeholder="e.g. Trek 3500 Mountain Bike, barely used"
          className="input"
          minLength={3}
          maxLength={120}
          required
          disabled={isPending}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="auction-description" className="label">Description *</label>
        <textarea
          id="auction-description"
          name="description"
          defaultValue={defaultValues.description}
          placeholder="Describe the item honestly — condition, any defects, accessories included…"
          className="input min-h-32 resize-y"
          minLength={10}
          maxLength={2000}
          required
          disabled={isPending}
        />
      </div>

      {/* Category & Condition */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="auction-category" className="label">Category *</label>
          <select
            id="auction-category"
            name="category"
            defaultValue={defaultValues.category ?? ""}
            className="input"
            required
            disabled={isPending}
          >
            <option value="" disabled>Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="auction-condition" className="label">Condition *</label>
          <select
            id="auction-condition"
            name="condition"
            defaultValue={defaultValues.condition ?? ""}
            className="input"
            required
            disabled={isPending}
          >
            <option value="" disabled>Select condition</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Prices — only for create */}
      {!isEdit && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="auction-start-price" className="label">Starting Price (₹) *</label>
            <input
              id="auction-start-price"
              type="number"
              name="startingPriceRupees"
              min={1}
              step={1}
              placeholder="e.g. 500"
              className="input"
              required
              disabled={isPending}
            />
            {/* Converted to paise via hidden field by JS */}
            <input type="hidden" name="startingPricePaise" id="starting-price-paise" />
          </div>
          <div>
            <label htmlFor="auction-increment" className="label">Min Increment (₹) *</label>
            <input
              id="auction-increment"
              type="number"
              name="minimumIncrementRupees"
              min={1}
              step={1}
              placeholder="e.g. 50"
              className="input"
              required
              disabled={isPending}
            />
            <input type="hidden" name="minimumIncrementPaise" id="minimum-increment-paise" />
          </div>
        </div>
      )}

      {/* Dates — only for create */}
      {!isEdit && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="auction-opens-at" className="label">Opens At *</label>
            <input
              id="auction-opens-at"
              type="datetime-local"
              name="opensAt"
              className="input"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label htmlFor="auction-closes-at" className="label">Closes At *</label>
            <input
              id="auction-closes-at"
              type="datetime-local"
              name="closesAt"
              className="input"
              required
              disabled={isPending}
            />
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
        className="btn btn-primary btn-lg w-full"
        disabled={isPending}
        id={`auction-submit-${mode}`}
      >
        {isPending
          ? isEdit ? "Saving changes…" : "Creating listing…"
          : isEdit ? "Save Changes" : "Create Listing"}
      </button>

      {/* Client-side paise conversion */}
      {!isEdit && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function sync(id, paiseId) {
                  var el = document.getElementById(id);
                  var hidden = document.getElementById(paiseId);
                  if (!el || !hidden) return;
                  el.addEventListener('input', function() {
                    hidden.value = Math.round(parseFloat(el.value || 0) * 100);
                  });
                }
                sync('auction-start-price', 'starting-price-paise');
                sync('auction-increment', 'minimum-increment-paise');
              })();
            `,
          }}
        />
      )}
    </form>
  );
}
