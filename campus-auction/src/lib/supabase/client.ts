/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client — uses the anon key only.
 * Never import server-side secrets here.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
