'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      window.location.href = '/dashboard';
      return;
    }

    setCheckingSession(false);
  }

  async function signInWithGoogle() {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      alert(error.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert('Please enter email and password.');
      return;
    }

    try {
      setLoading(true);

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        });

        if (error) throw error;

        alert(
          'Account created. If email confirmation is enabled, check your inbox before signing in.'
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      window.location.href = '/dashboard';
    } catch (error: any) {
      alert(error.message || 'Email authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-lg text-zinc-300 animate-pulse">Loading TaskMate...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-md pt-8">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <img
              src="/taskmate_login_logo.png"
              alt="TaskMate"
              className="w-full max-w-[280px] h-auto"
            />
          </div>

          <p className="mt-3 text-base text-zinc-400">
            Shared tasks. Simple teamwork.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-base font-semibold text-black transition hover:scale-[0.995] hover:opacity-95 active:scale-[0.985] disabled:opacity-60"
          >
            {loading ? 'Please wait...' : 'Continue with Google'}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-sm text-zinc-500">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-white outline-none placeholder:text-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900/90"
            />

            <input
              type="password"
              placeholder="Password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-white outline-none placeholder:text-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900/90"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-zinc-200 px-4 py-4 text-base font-semibold text-black transition hover:bg-white hover:scale-[0.995] active:scale-[0.985] disabled:opacity-60"
            >
              {loading
                ? 'Please wait...'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in with email'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-4 w-full text-sm text-zinc-400 transition hover:text-white"
          >
            {mode === 'signin'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </main>
  );
}
