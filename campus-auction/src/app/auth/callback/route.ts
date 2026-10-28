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

  // Production behind reverse proxy (Render): ensure HTTPS and canonical host
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to next param (must be a relative path)
      const safeNext = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    }
  }

  // On error, send user back to sign-in with an error indicator
  return NextResponse.redirect(`${baseUrl}/sign-in?error=auth_callback`);
}
