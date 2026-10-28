"use client";
/**
 * src/app/(auth)/sign-up/page.tsx
 *
 * Modern sign-up page with dedicated Buyer vs. Seller account selection.
 */
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { IconShieldCheck, IconCheck } from "@/components/ui/icons";

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
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
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined"
        ? window.location.origin
        : "https://thecloudcompany.onrender.com");

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
        data: {
          display_name: displayName.trim(),
          role,
        },
      },
    });

    if (authError) {
      setError(authError.message ?? "Sign up failed. Please try again.");
      setIsPending(false);
      return;
    }

    if (authData.session) {
      // Auto-signed in! Redirect directly to corresponding dashboard
      const targetDashboard = role === "seller" ? "/dashboard/seller" : "/dashboard/winner";
      window.location.href = targetDashboard;
      return;
    }

    // Email confirmation required by Supabase project settings
    setSuccess(true);
    setIsPending(false);
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center glass p-8 sm:p-10 rounded-3xl border border-white/[0.1] bg-[#12131e]/90 shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-3xl mb-5">
            ✉️
          </div>
          <h2 className="text-2xl font-display font-extrabold text-white mb-2">Check your email</h2>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            We&apos;ve sent a confirmation link to{" "}
            <span className="text-white font-semibold">{email}</span>. Click the link to complete registration.
          </p>
          <Link href="/sign-in" className="btn btn-secondary btn-md w-full">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white text-2xl shadow-lg shadow-brand-900/50 mb-4 border border-brand-400/30">
            🎓
          </div>
          <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
            Create an Account
          </h1>
          <p className="text-white/50 text-sm mt-1.5">
            Join the verified campus auction community
          </p>
        </div>

        {/* Card */}
        <div className="glass p-7 sm:p-8 space-y-6 rounded-3xl border border-white/[0.1] bg-[#12131e]/80 shadow-2xl">
          {error && (
            <div className="alert-error animate-slide-down" role="alert">
              <span aria-hidden="true">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Account Role Selector */}
            <div>
              <label className="label">Select Account Role *</label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setRole("buyer")}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    role === "buyer"
                      ? "bg-brand-500/20 border-brand-400/60 shadow-lg shadow-brand-900/30 ring-1 ring-brand-400/50"
                      : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                  }`}
                >
                  {role === "buyer" && (
                    <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center text-[10px] text-white">
                      ✓
                    </span>
                  )}
                  <span className="text-2xl block mb-1">🛒</span>
                  <p className="text-sm font-bold text-white">Buyer</p>
                  <p className="text-[11px] text-white/50 leading-tight mt-0.5">
                    Bid & pickup campus items
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("seller")}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    role === "seller"
                      ? "bg-purple-500/20 border-purple-400/60 shadow-lg shadow-purple-900/30 ring-1 ring-purple-400/50"
                      : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                  }`}
                >
                  {role === "seller" && (
                    <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white">
                      ✓
                    </span>
                  )}
                  <span className="text-2xl block mb-1">🏷️</span>
                  <p className="text-sm font-bold text-white">Seller</p>
                  <p className="text-[11px] text-white/50 leading-tight mt-0.5">
                    List & sell to campus peers
                  </p>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="display-name" className="label">
                Display Name (Visible to peers)
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
                placeholder="e.g. Alex Chen"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isPending}
              />
            </div>

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
              className="btn btn-primary btn-lg w-full font-bold shadow-lg shadow-brand-900/40 mt-3"
              disabled={isPending}
            >
              {isPending ? "Setting up account…" : "Complete Registration"}
            </button>
          </form>

          <div className="pt-4 border-t border-white/[0.08] text-center">
            <p className="text-xs text-white/50">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-brand-300 hover:text-brand-200 font-semibold transition-colors ml-1"
              >
                Sign in →
              </Link>
            </p>
          </div>
        </div>

        {/* Security footer note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/30 mt-6">
          <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-time instant campus account activation</span>
        </div>
      </div>
    </div>
  );
}
