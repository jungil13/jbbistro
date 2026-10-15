import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  let next = searchParams.get('next') ?? '/profile';

  // Format destination URL
  if ((type === 'signup' || type === 'email' || !searchParams.has('next')) && next !== '/auth/reset-password' && type !== 'recovery') {
    if (!next.includes('verified=')) {
      next = next.includes('?') ? `${next}&verified=true` : `${next}?verified=true`;
    }
  }

  const getRedirectUrl = (path: string) => {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    if (isLocalEnv) {
      return `${origin}${path}`;
    } else if (forwardedHost) {
      return `https://${forwardedHost}${path}`;
    } else {
      return `${origin}${path}`;
    }
  };

  // Check if provider returned an explicit error
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const errorCode = searchParams.get('error_code');
  if (errorParam || errorDescription || errorCode) {
    const errorMsg = errorDescription || errorParam || 'auth_callback_failed';
    if (next === '/auth/reset-password' || type === 'recovery') {
      return NextResponse.redirect(
        `${origin}/auth/reset-password?error=${encodeURIComponent(errorMsg)}&error_code=${encodeURIComponent(errorCode || '')}`
      );
    }
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // Target destination response
  const targetUrl = getRedirectUrl(next);
  const response = NextResponse.redirect(targetUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 1. Support token_hash verification (email confirmation links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return response;
    }
    console.error('verifyOtp error in callback route:', error.message);
  }

  // 2. Support PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error('exchangeCodeForSession error in callback route:', error.message);
  }

  // 3. Fallback for Sign-Up / Email Confirmations:
  // If Supabase already marked the email as verified on their server, but the PKCE code
  // could not be exchanged into a session in this tab/window, redirect to login with verified=true
  // instead of showing a confusing "link expired or invalid" error!
  if (type === 'signup' || type === 'email' || searchParams.has('type') || (!code && !token_hash)) {
    return NextResponse.redirect(`${origin}/login?verified=true`);
  }

  // Recovery error fallback
  if (next === '/auth/reset-password' || type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password?error=auth_callback_failed`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
