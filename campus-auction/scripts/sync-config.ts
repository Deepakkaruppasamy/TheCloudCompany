/**
 * scripts/sync-config.ts
 *
 * Writes deadline durations to system_config at deploy time.
 * Run once per deploy and when demo settings change.
 * Never prints secret values.
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`[sync-config] Required env var "${name}" is missing.`);
  }
  return v.trim();
}

function parsePositiveInt(name: string, raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`[sync-config] "${name}" must be a positive integer.`);
  }
  return n;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const demoMode = requireEnv("DEMO_MODE");

  if (demoMode !== "true" && demoMode !== "false") {
    throw new Error('[sync-config] DEMO_MODE must be "true" or "false".');
  }

  let sellerResponseSeconds: number;
  let pickupSeconds: number;

  if (demoMode === "true") {
    const rawMinutes = requireEnv("SELLER_RESPONSE_MINUTES");
    const rawPickup = requireEnv("PICKUP_MINUTES");
    sellerResponseSeconds = parsePositiveInt("SELLER_RESPONSE_MINUTES", rawMinutes) * 60;
    pickupSeconds = parsePositiveInt("PICKUP_MINUTES", rawPickup) * 60;
    console.log(`[sync-config] Demo mode: seller_response=${sellerResponseSeconds}s, pickup=${pickupSeconds}s`);
  } else {
    const rawHours = requireEnv("SELLER_RESPONSE_HOURS");
    const rawPickup = requireEnv("PICKUP_HOURS");
    sellerResponseSeconds = parsePositiveInt("SELLER_RESPONSE_HOURS", rawHours) * 3600;
    pickupSeconds = parsePositiveInt("PICKUP_HOURS", rawPickup) * 3600;
    console.log(`[sync-config] Production mode: seller_response=${sellerResponseSeconds}s, pickup=${pickupSeconds}s`);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Upsert both config entries
  const { error } = await supabase.from("system_config").upsert([
    { key: "seller_response_seconds", value_seconds: sellerResponseSeconds },
    { key: "pickup_seconds", value_seconds: pickupSeconds },
  ]);

  if (error) {
    console.error("[sync-config] Failed to upsert system_config:", error.message);
    process.exit(1);
  }

  console.log("[sync-config] system_config updated successfully.");
}

main().catch((err) => {
  console.error("[sync-config] Error:", err.message);
  process.exit(1);
});
