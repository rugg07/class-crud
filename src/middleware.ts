import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (pathname === '/login' || pathname === '/api/dev-login') {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const session = request.cookies.get('session')?.value;
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token
  const payload = await verifyToken(session);
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }

  // Check role-based access
  if (pathname.startsWith('/admin') && payload.role !== 'admin') {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }
  if (pathname.startsWith('/teacher') && payload.role !== 'teacher') {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }
  if (pathname.startsWith('/student') && payload.role !== 'student') {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/student/:path*'],
};
