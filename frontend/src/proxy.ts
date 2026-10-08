import { NextResponse, type NextRequest } from 'next/server';
import { signInUrl } from '@/features/auth/redirect';

// Must match the backend's SESSION_COOKIE_NAME.
const SESSION_COOKIE = 'r53_session';

/**
 * Send visitors without a session cookie to the sign-in page before any
 * console page renders. This only checks that the cookie exists; the backend
 * decides whether it is valid, and the console handles a 401 if it is not.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(signInUrl(pathname + search), request.url));
}

export const config = {
  matcher: ['/route53/:path*'],
};
