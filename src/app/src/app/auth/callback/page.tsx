"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("exchangeCodeForSession error:", error.message);
            router.replace("/");
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace("/dashboard");
        } else {
          router.replace("/");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        router.replace("/");
      }
    };

    handleAuth();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-zinc-400 text-lg">Signing you in...</div>
    </main>
  );
}
