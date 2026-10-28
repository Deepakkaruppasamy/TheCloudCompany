"use client";
/**
 * src/app/(auth)/sign-in/page.tsx
 *
 * Clean and modern sign-in page with email/password authentication.
 */
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { IconShieldCheck } from "@/components/ui/icons";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    callbackError === "auth_callback"
      ? "Authentication callback failed. Please sign in again."
      : null
  );
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message ?? "Sign in failed. Please check your credentials.");
      setIsPending(false);
      return;
    }

    if (data.session) {
      if (next === "/" && data.user) {
        // Direct to their dedicated role dashboard if no specific page was requested
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        const role = (profile as { role?: string } | null)?.role;
        if (role === "seller") {
          window.location.href = "/dashboard/seller";
          return;
        }
      }
      // Full reload so all server components and middleware sync with the session cookie immediately
      window.location.href = next;
    } else {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white text-2xl shadow-lg shadow-brand-900/50 mb-4 border border-brand-400/30">
            🏛️
          </div>
          <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
            Welcome back
          </h1>
          <p className="text-white/50 text-sm mt-1.5">
            Sign in to your campus auction account
          </p>
        </div>

        {/* Form Card */}
        <div className="glass p-7 sm:p-8 space-y-6 rounded-3xl border border-white/[0.1] bg-[#12131e]/80 shadow-2xl">
          {error && (
            <div className="alert-error animate-slide-down" role="alert">
              <span aria-hidden="true">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">
                Campus Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="label mb-0">
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full font-bold shadow-lg shadow-brand-900/40 mt-2"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-white/[0.08] text-center">
            <p className="text-xs text-white/50">
              Don&apos;t have an account yet?{" "}
              <Link
                href="/sign-up"
                className="text-brand-300 hover:text-brand-200 font-semibold transition-colors ml-1"
              >
                Create one now →
              </Link>
            </p>
          </div>
        </div>

        {/* Security footer note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/30 mt-6">
          <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secured with Supabase Auth & PostgreSQL RLS</span>
        </div>
      </div>
    </div>
  );
}
