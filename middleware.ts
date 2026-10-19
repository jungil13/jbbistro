import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function createRedirect(url: string | URL, responseWithCookies?: NextResponse) {
  const redirectRes = NextResponse.redirect(url);
  if (responseWithCookies) {
    responseWithCookies.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie);
    });
  }
  return redirectRes;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Intercept any auth code landing on the site (e.g., http://localhost:3000/?code=...)
  if (pathname !== "/auth/callback" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const callbackUrl = new URL("/auth/callback", request.url);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    if (!callbackUrl.searchParams.has("next")) {
      const type = searchParams.get("type");
      if (type === "recovery") {
        callbackUrl.searchParams.set("next", "/auth/reset-password");
      } else {
        callbackUrl.searchParams.set("next", "/profile?verified=true");
      }
    }
    return NextResponse.redirect(callbackUrl);
  }

  // 2. Intercept any auth errors landing on the site (e.g., http://localhost:3000/?error=access_denied&error_code=otp_expired...)
  if (
    pathname !== "/auth/reset-password" &&
    pathname !== "/login" &&
    (searchParams.has("error") || searchParams.has("error_code") || searchParams.has("error_description"))
  ) {
    const isRecoveryError =
      searchParams.get("type") === "recovery" ||
      searchParams.get("error_code") === "otp_expired" ||
      searchParams.get("error_description")?.toLowerCase().includes("expired");

    const targetUrl = new URL(isRecoveryError ? "/auth/reset-password" : "/login", request.url);
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(targetUrl);
  }

  // 3. Setup Supabase client for session cookie refreshes
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
            supabaseResponse.cookies.set(name, value, {
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              ...options,
            })
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const loginRedirectUrl = new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url);

      // Protect admin routes
      if (pathname.startsWith("/admin")) {
        if (!user) {
          return createRedirect(loginRedirectUrl, supabaseResponse);
        }
        const { data: profile, error: profError } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .single();

        if (profError || !profile || profile.status === "inactive") {
          return createRedirect(new URL("/login", request.url), supabaseResponse);
        }

        if (profile.role === "admin") {
          return supabaseResponse;
        }

        if (profile.role === "staff") {
          // Staff cannot access administrative configuration or managerial views
          if (
            pathname.startsWith("/admin/staff") ||
            pathname.startsWith("/admin/settings") ||
            pathname.startsWith("/admin/announcements") ||
            pathname.startsWith("/admin/promotions") ||
            pathname.startsWith("/admin/menu") ||
            pathname.startsWith("/admin/ratings") ||
            pathname.startsWith("/admin/analytics")
          ) {
            return createRedirect(new URL("/admin", request.url), supabaseResponse);
          }

          // Fetch staff permissions
          const { data: perms } = await supabase
            .from("staff_permissions")
            .select("can_dashboard, can_reservations, can_services")
            .eq("staff_id", user.id)
            .single();

          if (pathname.startsWith("/admin/reservations") && !perms?.can_reservations) {
            return createRedirect(new URL("/admin", request.url), supabaseResponse);
          }

          if (pathname.startsWith("/admin/services") && !perms?.can_services) {
            return createRedirect(new URL("/admin", request.url), supabaseResponse);
          }

          return supabaseResponse;
        }

        if (profile.role === "manager") {
          return createRedirect(new URL("/manager", request.url), supabaseResponse);
        }

        return createRedirect(new URL("/login", request.url), supabaseResponse);
      }

      // Protect manager routes
      if (pathname.startsWith("/manager")) {
        if (!user) {
          return createRedirect(loginRedirectUrl, supabaseResponse);
        }
        const { data: profile, error: profError } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .single();

        if (profError || !profile || profile.status === "inactive" || !["admin", "manager"].includes(profile.role)) {
          return createRedirect(new URL("/login", request.url), supabaseResponse);
        }
      }

      // Protect profile route
      if (pathname.startsWith("/profile")) {
        if (!user) {
          return createRedirect(loginRedirectUrl, supabaseResponse);
        }
      }
    } catch (err) {
      console.error("[Middleware] Protected route check error:", err);
      if (pathname.startsWith("/admin") || pathname.startsWith("/manager")) {
        return createRedirect(new URL("/login", request.url), supabaseResponse);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|mp3|mp4)$).*)",
  ],
};
