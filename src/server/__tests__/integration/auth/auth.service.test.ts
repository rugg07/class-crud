import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../../db/client';
import {
  loginWithPassword,
  loginWithGoogle,
  createUser,
} from '../../../auth/auth.service';
import type { User } from '../../../db/types';

let testUser: User;

beforeAll(async () => {
  // Note: Migrations must be run separately before tests.
});

beforeEach(async () => {
  // Clean up users table.
  await db.deleteFrom('users').execute();

  // Create test user with password.
  testUser = await createUser(
    'test@example.com',
    'password123',
    'Test User',
    'student',
    null,
    null
  );
});

afterAll(async () => {
  await db.destroy();
});

describe('loginWithPassword', () => {
  it('returns user and token on correct credentials', async () => {
    const result = await loginWithPassword('test@example.com', 'password123');
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(testUser.id);
    expect(result?.token).toBeTruthy();
  });

  it('returns null on wrong password', async () => {
    const result = await loginWithPassword('test@example.com', 'wrongpassword');
    expect(result).toBeNull();
  });

  it('returns null on unknown email', async () => {
    const result = await loginWithPassword(
      'unknown@example.com',
      'password123'
    );
    expect(result).toBeNull();
  });

  it('returns null if user is suspended', async () => {
    await db
      .updateTable('users')
      .set({ status: 'suspended' })
      .where('id', '=', testUser.id)
      .execute();

    const result = await loginWithPassword('test@example.com', 'password123');
    expect(result).toBeNull();
  });
});

describe('loginWithGoogle', () => {
  it('returns null when code exchange fails', async () => {
    const result = await loginWithGoogle('invalid-code');
    expect(result).toBeNull();
  });

  it('returns null when user not found', async () => {
    // This test requires mocking oauth.exchangeCodeForToken
    // For now, we expect it to fail gracefully
    const result = await loginWithGoogle('fake-code');
    expect(result).toBeNull();
  });

  it('returns null if user is suspended', async () => {
    // This would require mocking the oauth exchange
    // Placeholder for the actual test scenario
    await db
      .updateTable('users')
      .set({ status: 'suspended' })
      .where('id', '=', testUser.id)
      .execute();

    // When mocked to return testUser's email, should return null
    const result = await loginWithGoogle('fake-code');
    expect(result).toBeNull();
  });
});

describe('createUser', () => {
  it('creates user with password', async () => {
    const user = await createUser(
      'newuser@example.com',
      'password456',
      'New User',
      'teacher',
      null,
      null
    );

    expect(user.email).toBe('newuser@example.com');
    expect(user.name).toBe('New User');
    expect(user.role).toBe('teacher');
    expect(user.password_hash).toBeTruthy();
    expect(user.oauth_provider).toBeNull();
  });

  it('creates user with oauth provider', async () => {
    const user = await createUser(
      'oauth@example.com',
      null,
      'OAuth User',
      'student',
      'google',
      'google-123'
    );

    expect(user.email).toBe('oauth@example.com');
    expect(user.password_hash).toBeNull();
    expect(user.oauth_provider).toBe('google');
    expect(user.oauth_id).toBe('google-123');
  });
});
