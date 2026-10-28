/**
 * src/lib/server/admin.ts
 *
 * Service-role Supabase client — server-only.
 * NEVER import this from any browser code or client component.
 * This is the sole module that may create a service-role client.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let _adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getAdminClient() {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[admin] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Check server environment."
    );
  }

  _adminClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}
