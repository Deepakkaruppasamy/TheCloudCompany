"use client";
/**
 * src/app/(auth)/sign-up/page.tsx
 *
 * Sign-up page — creates a new account via Supabase auth with a display name.
 */
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      setIsPending(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsPending(false);
      return;
    }

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
      },
    });

    if (authError) {
      setError(authError.message ?? "Sign up failed. Please try again.");
      setIsPending(false);
      return;
    }

    if (authData.session) {
      // Auto-signed in! Redirect directly into the app
      window.location.href = "/";
      return;
    }

    // Email confirmation required by Supabase project settings
    setSuccess(true);
    setIsPending(false);
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-6">
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-3">Check your email</h2>
          <p className="text-white/60 mb-6">
            We&apos;ve sent a confirmation link to{" "}
            <span className="text-white font-medium">{email}</span>. Click the link to activate your
            account.
          </p>
          <Link href="/sign-in" className="btn btn-secondary btn-md">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-500/30 mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Create account</h1>
          <p className="text-white/50 text-sm">Join Campus Auction today</p>
        </div>

        {/* Card */}
        <div className="glass p-8 space-y-6">
          {error && (
            <div className="alert-error animate-slide-down" role="alert">
              <span aria-hidden="true">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="display-name" className="label">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                name="display_name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={50}
                className="input"
                placeholder="Your name on campus"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email address
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
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={isPending}
            >
              {isPending ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-white/50">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
