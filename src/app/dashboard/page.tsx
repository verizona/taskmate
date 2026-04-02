"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        window.location.href = "/";
        return;
      }

      setEmail(session.user.email ?? null);
      setLoading(false);
    }

    loadSession();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-zinc-400 text-lg">Loading TaskMate...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-3 text-zinc-400">
          Signed in as {email ?? "unknown user"}
        </p>

        <button
          onClick={signOut}
          className="mt-6 rounded-2xl bg-white px-4 py-3 font-medium text-black hover:bg-zinc-200"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
