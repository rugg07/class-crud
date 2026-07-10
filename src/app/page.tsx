import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/jwt';

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    redirect('/login');
  }

  const payload = await verifyToken(session);
  if (!payload) {
    redirect('/login');
  }

  redirect(`/${payload.role}`);
}
