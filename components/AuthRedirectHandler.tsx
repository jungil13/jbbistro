"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // 1. Check if hash fragment contains recovery or error
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        router.push(`/auth/reset-password${hash}`);
        return;
      }
    }

    // 2. Listen to PASSWORD_RECOVERY auth event
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/auth/reset-password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
