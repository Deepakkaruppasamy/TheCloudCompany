/**
 * src/lib/rate-limit.ts
 *
 * Calls the durable Postgres rate limiter via service-role RPC.
 * In-memory fallback is intentionally NOT used; all limits are durable.
 */
import "server-only";
import { getAdminClient } from "@/lib/server/admin";

export async function checkReconcileRateLimit(
  maxPerMinute: number = 10
): Promise<boolean> {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc("reconcile_rate_check", {
    max_per_minute: maxPerMinute,
  } as any);

  if (error) {
    console.error("[rate-limit] RPC error:", error.message);
    // Fail closed: if we cannot check, deny the request
    return false;
  }

  return data === true;
}
