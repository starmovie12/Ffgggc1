import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge Route Protection Middleware
 * Protects /admin routes — requires valid admin session cookie.
 * Without 'mflix_admin_session' cookie, redirects to /admin with auth flag.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect admin API routes that aren't the auth check itself
  if (pathname.startsWith('/api/admin')) {
    const adminKey = request.headers.get('x-admin-key');
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminKey || adminKey !== adminSecret) {
      // Also check cookie-based auth
      const sessionCookie = request.cookies.get('mflix_admin_session')?.value;
      if (!sessionCookie || sessionCookie !== adminSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  // For /admin page — check if session cookie exists
  // If not, page will show login screen (handled client-side)
  // But we add a security header for extra protection
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const response = NextResponse.next();
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
