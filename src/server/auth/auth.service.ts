import { db } from '../db/client';
import type { User } from '../db/types';
import { signToken } from './jwt';
import { verifyPassword, hashPassword } from './password';
import {
  exchangeCodeForToken,
  getGoogleProfile,
} from './oauth';

// Look up user by email, verify password, check status, sign JWT.
export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ user: User; token: string } | null> {
  const user = await db
    .selectFrom('users')
    .where('email', '=', email)
    .selectAll()
    .executeTakeFirst();

  if (!user || !user.password_hash) {
    return null;
  }

  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }

  if (user.status === 'suspended') {
    return null;
  }

  const token = signToken(user.id, user.role);
  return { user, token };
}

// Exchange OAuth code for token, decode profile, look up user, sign JWT.
export async function loginWithGoogle(
  googleCode: string
): Promise<{ user: User; token: string } | null> {
  const tokens = await exchangeCodeForToken(googleCode);
  if (!tokens) {
    return null;
  }

  const profile = await getGoogleProfile(tokens.id_token);
  if (!profile) {
    return null;
  }

  const user = await db
    .selectFrom('users')
    .where('email', '=', profile.email)
    .selectAll()
    .executeTakeFirst();

  if (!user) {
    return null;
  }

  if (user.status === 'suspended') {
    return null;
  }

  const token = signToken(user.id, user.role);
  return { user, token };
}

// Insert user row with email, password hash, name, role, oauth fields.
export async function createUser(
  email: string,
  password: string | null,
  name: string,
  role: string,
  oauth_provider: string | null,
  oauth_id: string | null
): Promise<User> {
  const password_hash = password ? hashPassword(password) : null;

  const result = await db
    .insertInto('users')
    .values({
      email,
      password_hash,
      name,
      role: role as 'admin' | 'teacher' | 'student',
      oauth_provider,
      oauth_id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
}
