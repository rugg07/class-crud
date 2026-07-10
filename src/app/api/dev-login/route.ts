// TEMPORARY: Dev-only login — will be replaced by real Fastify + OAuth backend
import { cookies } from 'next/headers';
import { signToken } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const { role, name, email } = await request.json();

    if (!role || !name || !email) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const token = await signToken({
      sub: email, // use email as a temporary user ID for dev
      role: role as 'admin' | 'teacher' | 'student',
      name,
    });

    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
