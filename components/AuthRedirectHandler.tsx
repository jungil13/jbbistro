"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;

    const hasAuthError =
      search.includes("error=") ||
      search.includes("error_code=") ||
      search.includes("error_description=") ||
      hash.includes("error=") ||
      hash.includes("error_code=") ||
      hash.includes("error_description=");

    if (hasAuthError && pathname !== "/auth/reset-password" && pathname !== "/login") {
      router.push(`/auth/reset-password${search}${hash}`);
      return;
    }

    if (hash && (hash.includes("type=recovery") || hash.includes("access_token="))) {
      if (pathname !== "/auth/reset-password") {
        router.push(`/auth/reset-password${hash}`);
        return;
      }
    }

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
