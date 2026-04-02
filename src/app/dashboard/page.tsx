"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      window.location.href = "/dashboard";
      return;
    }

    setCheckingSession(false);
  }

  async function handleMagicLinkSignIn() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      alert("Please enter your email.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined,
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Check your email for the login link.");
  }

  async function handleGoogleSignIn() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined,
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-zinc-400 text-lg">Loading TaskMate...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950/90 p-8 shadow-2xl shadow-black/40">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">TaskMate</h1>
          <p className="mt-3 text-zinc-400">
            Shared tasks. Simple teamwork.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <div className="h-px flex-1 bg-white/10" />
            <span>or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <button
            onClick={handleMagicLinkSignIn}
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </div>

        <p className="mt-6 text-sm leading-6 text-zinc-500">
          Use Google sign-in or get a secure login link by email.
        </p>
      </div>
    </main>
  );
}