'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Signing you in...');

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (!code) {
          setMessage('Missing login code. Redirecting...');
          router.replace('/');
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('exchangeCodeForSession error:', error);
          setMessage(`Login failed: ${error.message}`);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setMessage('No session was created. Redirecting...');
          router.replace('/');
          return;
        }

        router.replace('/dashboard');
      } catch (err) {
        console.error('Auth callback error:', err);
        setMessage('Unexpected login error.');
      }
    }

    handleAuthCallback();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-zinc-400 text-lg">{message}</div>
    </main>
  );
}
