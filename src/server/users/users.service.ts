import { db } from '../db/client';
import type { User, UsersTable } from '../db/types';
import type { Updateable } from 'kysely';
import { hashPassword } from '../auth/password';

// Fetch all users with pagination (including suspended).
export async function listUsers(
  limit: number = 20,
  offset: number = 0
): Promise<{ users: User[]; total: number }> {
  const users = await db
    .selectFrom('users')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  const countResult = await db
    .selectFrom('users')
    .select(db.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow();

  return { users, total: parseInt(String(countResult.count), 10) };
}

// Fetch user by ID.
export async function getUserById(id: string): Promise<User | null> {
  const user = await db
    .selectFrom('users')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();
  return user || null;
}

// Create user with optional password (hashed).
export async function createUser(
  email: string,
  name: string,
  role: 'admin' | 'teacher' | 'student',
  password?: string
): Promise<User> {
  const password_hash = password ? hashPassword(password) : null;

  const user = await db
    .insertInto('users')
    .values({
      email,
      name,
      role,
      password_hash,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return user;
}

// Update user name, role, or status.
export async function updateUser(
  id: string,
  updates: { name?: string; role?: string; status?: string }
): Promise<User | null> {
  const normalizedUpdates: Updateable<UsersTable> = {};
  if (updates.name !== undefined) normalizedUpdates.name = updates.name;
  if (updates.role !== undefined) normalizedUpdates.role = updates.role as any;
  if (updates.status !== undefined) normalizedUpdates.status = updates.status as any;

  const user = await db
    .updateTable('users')
    .set(normalizedUpdates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return user || null;
}

// Soft-delete: set status = 'suspended'.
export async function suspendUser(id: string): Promise<User | null> {
  const user = await db
    .updateTable('users')
    .set({ status: 'suspended' })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return user || null;
}

// Reactivate: set status = 'active'.
export async function unsuspendUser(id: string): Promise<User | null> {
  const user = await db
    .updateTable('users')
    .set({ status: 'active' })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return user || null;
}
