/**
 * scripts/reconcile-manual.ts
 *
 * Operator-only manual trigger for process_expired.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.
 * Never exposes secrets in logs.
 */
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`[reconcile-manual] Missing env: "${name}"`);
  return v.trim();
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[reconcile-manual] Calling process_expired(batch_size=50)...");
  const { data, error } = await (supabase.rpc as any)("process_expired", { batch_size: 50 });

  if (error) {
    console.error("[reconcile-manual] Error:", error.message);
    process.exit(1);
  }

  console.log("[reconcile-manual] Result:", JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("[reconcile-manual] Unexpected error:", err.message);
  process.exit(1);
});
