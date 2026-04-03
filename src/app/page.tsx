'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
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
      window.location.href = '/dashboard';
      return;
    }

    setCheckingSession(false);
  }

  async function signIn() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`, // ✅ FIXED
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-zinc-400 text-lg">Loading TaskMate...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950/90 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-4xl font-semibold tracking-tight">TaskMate</h1>

        <p className="mt-3 text-zinc-400">
          Shared tasks. Simple teamwork.
        </p>

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-8 w-full rounded-2xl bg-white px-4 py-3 font-medium text-black hover:bg-zinc-200 active:scale-[0.98] transition disabled:opacity-60"
        >
          {loading ? 'Please wait...' : 'Continue with Google'}
        </button>
      </div>
    </main>
  );
}
