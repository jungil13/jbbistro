import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Intercept any auth code landing on the site (e.g., http://localhost:3000/?code=...)
  if (pathname !== "/auth/callback" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const callbackUrl = new URL("/auth/callback", request.url);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    if (!callbackUrl.searchParams.has("next")) {
      callbackUrl.searchParams.set("next", "/auth/reset-password");
    }
    return NextResponse.redirect(callbackUrl);
  }

  // 2. Intercept any auth errors landing on the site (e.g., http://localhost:3000/?error=access_denied&error_code=otp_expired...)
  if (
    pathname !== "/auth/reset-password" &&
    pathname !== "/login" &&
    (searchParams.has("error") || searchParams.has("error_code") || searchParams.has("error_description"))
  ) {
    const resetUrl = new URL("/auth/reset-password", request.url);
    searchParams.forEach((value, key) => {
      resetUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(resetUrl);
  }

  // 2. Setup Supabase client for session cookie refreshes
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/profile");

  if (isProtected) {
    const { data: { user } } = await supabase.auth.getUser();

    // Protect admin routes
    if (pathname.startsWith("/admin")) {
      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    // Protect manager routes
    if (pathname.startsWith("/manager")) {
      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!["admin", "manager"].includes(profile?.role ?? "")) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    // Protect profile route
    if (pathname.startsWith("/profile")) {
      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
