/**
 * src/app/(auth)/auth/callback/route.ts
 *
 * Supabase OAuth / email-confirmation callback handler.
 * Exchanges the auth code for a session and redirects the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to next param (must be a relative path)
      const safeNext = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // On error, send user back to sign-in with an error indicator
  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback`);
}
