/**
 * src/lib/auth/session.ts
 *
 * Session and authorization helpers.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Returns the current authenticated user or redirects to sign-in. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in");
  }

  return user;
}

/** Returns the current user if authenticated, null otherwise. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user's profile or null. */
export async function getUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_verified, account_status")
    .eq("id", user.id)
    .single();

  return data;
}
