'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      router.replace('/dashboard');
    }

    handleAuth();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-zinc-400 text-lg">Signing you in...</div>
    </main>
  );
}
