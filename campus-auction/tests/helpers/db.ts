/**
 * tests/helpers/db.ts
 *
 * Database connection and test helpers for DB integration tests.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "your-service-role-key";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "your-anon-key";

/** Admin client with service role */
export function adminClient() {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Anon client (unauthenticated) */
export function anonClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Authenticated client for a given user */
export async function userClient(email: string, password: string) {
  const c = createClient(url, anonKey);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Test sign-in failed for ${email}: ${error.message}`);
  return c;
}

/** Create a test user via admin API and return their id and client */
export async function createTestUser(opts: {
  email: string;
  password: string;
  displayName: string;
  verified?: boolean;
}) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { display_name: opts.displayName },
  });
  if (error) throw new Error(`createTestUser failed: ${error.message}`);
  const userId = data.user!.id;

  if (opts.verified !== false) {
    await admin.from("profiles").update({
      is_verified: true,
      account_status: "active",
    } as any).eq("id", userId);
  }

  const client = await userClient(opts.email, opts.password);
  return { userId, client };
}

/** Delete a test user by ID */
export async function deleteTestUser(userId: string) {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}
