/**
 * src/domain/money.ts
 *
 * Pure money conversion helpers.
 * All monetary values in the database use integer paise (1 INR = 100 paise).
 * Never use floating-point for monetary calculations.
 */

/** Convert paise (integer) to rupees display string */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error(`Invalid paise value: ${paise}`);
  }
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `₹${rupees.toLocaleString("en-IN")}${p > 0 ? `.${String(p).padStart(2, "0")}` : ""}`;
}

/** Convert rupees (number) to integer paise — rounds to nearest paise */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Validate that a paise value is a positive integer */
export function isValidPaise(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Minimum bid amount given current state */
export function minimumBidPaise(
  currentPricePaise: number | null,
  startingPricePaise: number,
  minimumIncrementPaise: number
): number {
  if (currentPricePaise === null) return startingPricePaise;
  return currentPricePaise + minimumIncrementPaise;
}
