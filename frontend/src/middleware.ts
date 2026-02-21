import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;
  const protectedPaths = ['/dashboard', '/admin', '/reports'];
  const isProtected = protectedPaths.some(p => pathname === p || pathname.startsWith(`${p}/`));
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = token ? '/dashboard' : '/auth/login';
    return NextResponse.redirect(url);
  }
  if (pathname === '/auth/login' && token) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard', '/admin/:path*', '/reports/:path*', '/branches/:path*', '/auth/login'],
};
