'use client'

import { supabase } from '@/lib/supabase'

export default function Home() {
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/dashboard',
      },
    })
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">TaskMate</h1>
        <p className="mb-6 text-gray-600">
          Shared tasks. Simple teamwork.
        </p>
        <button
          onClick={signIn}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}