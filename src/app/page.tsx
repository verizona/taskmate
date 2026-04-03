'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      window.location.href = '/dashboard'
      return
    }

    setCheckingSession(false)
  }

  async function signIn() {
    setLoading(true)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#131a2b,_#04070f_60%,_#010204_100%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-zinc-300 backdrop-blur-xl">
            Checking session...
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#131a2b,_#04070f_60%,_#010204_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <h1 className="text-5xl font-semibold tracking-tight">TaskMate</h1>
          <p className="mt-4 text-lg text-zinc-300">
            A calmer way to keep track of everything.
          </p>

          <div className="mt-8">
            <button
              onClick={signIn}
              disabled={loading}
              className="rounded-2xl bg-white px-5 py-3 font-medium text-black transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
