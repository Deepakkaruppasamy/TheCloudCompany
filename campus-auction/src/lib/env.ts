/**
 * src/lib/env.ts
 *
 * Validated environment configuration.
 * Startup fails with a clear message if required vars are missing or inconsistent.
 * Never prints secret values in error messages.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `[env] Required environment variable "${name}" is missing or empty. Check .env.local.`
    );
  }
  return v.trim();
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function parsePositiveInt(name: string, raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `[env] "${name}" must be a positive integer. Received value is invalid.`
    );
  }
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `[env] "${name}" must be a positive integer. Received value is invalid.`
    );
  }
  return n;
}

// ── Public Supabase ───────────────────────────────────────────────────────────
export const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// ── Server-only Supabase ──────────────────────────────────────────────────────
export function getServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

// ── Demo / Production mode ────────────────────────────────────────────────────
const demoModeRaw = requireEnv("DEMO_MODE");
if (demoModeRaw !== "true" && demoModeRaw !== "false") {
  throw new Error(
    `[env] "DEMO_MODE" must be exactly "true" or "false". Check .env.local.`
  );
}
export const DEMO_MODE: boolean = demoModeRaw === "true";

// ── Duration validation ───────────────────────────────────────────────────────
let sellerResponseSeconds: number;
let pickupSeconds: number;

if (DEMO_MODE) {
  // Require MINUTES vars; HOURS vars must not be set
  const missingMinutes: string[] = [];
  if (!optionalEnv("SELLER_RESPONSE_MINUTES"))
    missingMinutes.push("SELLER_RESPONSE_MINUTES");
  if (!optionalEnv("PICKUP_MINUTES")) missingMinutes.push("PICKUP_MINUTES");
  if (missingMinutes.length > 0) {
    throw new Error(
      `[env] DEMO_MODE=true requires ${missingMinutes.join(", ")} to be set. Check .env.local.`
    );
  }
  if (optionalEnv("SELLER_RESPONSE_HOURS") || optionalEnv("PICKUP_HOURS")) {
    throw new Error(
      `[env] DEMO_MODE=true: "SELLER_RESPONSE_HOURS" and "PICKUP_HOURS" must be unset. Check .env.local.`
    );
  }
  sellerResponseSeconds =
    parsePositiveInt(
      "SELLER_RESPONSE_MINUTES",
      requireEnv("SELLER_RESPONSE_MINUTES")
    ) * 60;
  pickupSeconds =
    parsePositiveInt("PICKUP_MINUTES", requireEnv("PICKUP_MINUTES")) * 60;
} else {
  // Require HOURS vars; MINUTES vars must not be set
  const missingHours: string[] = [];
  if (!optionalEnv("SELLER_RESPONSE_HOURS"))
    missingHours.push("SELLER_RESPONSE_HOURS");
  if (!optionalEnv("PICKUP_HOURS")) missingHours.push("PICKUP_HOURS");
  if (missingHours.length > 0) {
    throw new Error(
      `[env] DEMO_MODE=false requires ${missingHours.join(", ")} to be set. Check .env.local.`
    );
  }
  if (
    optionalEnv("SELLER_RESPONSE_MINUTES") ||
    optionalEnv("PICKUP_MINUTES")
  ) {
    throw new Error(
      `[env] DEMO_MODE=false: "SELLER_RESPONSE_MINUTES" and "PICKUP_MINUTES" must be unset. Check .env.local.`
    );
  }
  sellerResponseSeconds =
    parsePositiveInt(
      "SELLER_RESPONSE_HOURS",
      requireEnv("SELLER_RESPONSE_HOURS")
    ) *
    60 *
    60;
  pickupSeconds =
    parsePositiveInt("PICKUP_HOURS", requireEnv("PICKUP_HOURS")) * 60 * 60;
}

export const SELLER_RESPONSE_SECONDS = sellerResponseSeconds;
export const PICKUP_SECONDS = pickupSeconds;

// ── Reconcile secret ──────────────────────────────────────────────────────────
export function getReconcileSecret(): string {
  return requireEnv("RECONCILE_SECRET");
}

// ── Database URL (test/seed tooling only) ────────────────────────────────────
export function getDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}
