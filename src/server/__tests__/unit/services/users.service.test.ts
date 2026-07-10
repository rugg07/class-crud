import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/client';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  suspendUser,
  unsuspendUser,
} from '../../users/users.service';

describe('Users Service', () => {
  beforeEach(async () => {
    // Clean up in order of FK dependencies
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('enrollments').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('teacher_group_members').execute();
    await db.deleteFrom('teacher_groups').execute();
    await db.deleteFrom('users').execute();
  });

  afterEach(async () => {
    // Clean up in order of FK dependencies
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('enrollments').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('teacher_group_members').execute();
    await db.deleteFrom('teacher_groups').execute();
    await db.deleteFrom('users').execute();
  });

  describe('createUser', () => {
    it('should create a user with password', async () => {
      const user = await createUser(
        'test@example.com',
        'Test User',
        'student',
        'password123'
      );

      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.role).toBe('student');
      expect(user.password_hash).toBeTruthy();
      expect(user.status).toBe('active');
    });

    it('should create a user without password', async () => {
      const user = await createUser(
        'oauth@example.com',
        'OAuth User',
        'teacher'
      );

      expect(user.email).toBe('oauth@example.com');
      expect(user.name).toBe('OAuth User');
      expect(user.role).toBe('teacher');
      expect(user.password_hash).toBeNull();
    });
  });

  describe('listUsers', () => {
    it('should list all users with pagination', async () => {
      await createUser('user1@example.com', 'User 1', 'student', 'pass');
      await createUser('user2@example.com', 'User 2', 'teacher', 'pass');
      await createUser('user3@example.com', 'User 3', 'admin', 'pass');

      const result = await listUsers(10, 0);

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await createUser(
          `user${i}@example.com`,
          `User ${i}`,
          'student',
          'pass'
        );
      }

      const page1 = await listUsers(2, 0);
      const page2 = await listUsers(2, 2);

      expect(page1.users).toHaveLength(2);
      expect(page2.users).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.total).toBe(5);
    });

    it('should include suspended users', async () => {
      const user = await createUser('user@example.com', 'User', 'student');
      await suspendUser(user.id);

      const result = await listUsers(10, 0);

      expect(result.users).toHaveLength(1);
      expect(result.users[0]!.status).toBe('suspended');
    });
  });

  describe('getUserById', () => {
    it('should fetch user by id', async () => {
      const created = await createUser(
        'test@example.com',
        'Test User',
        'student'
      );
      const user = await getUserById(created.id);

      expect(user).not.toBeNull();
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null if user not found', async () => {
      const user = await getUserById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user name', async () => {
      const user = await createUser('test@example.com', 'Test', 'student');
      const updated = await updateUser(user.id, { name: 'Updated' });

      expect(updated?.name).toBe('Updated');
      expect(updated?.email).toBe('test@example.com');
    });

    it('should update user role', async () => {
      const user = await createUser('test@example.com', 'Test', 'student');
      const updated = await updateUser(user.id, { role: 'teacher' });

      expect(updated?.role).toBe('teacher');
    });

    it('should return null if user not found', async () => {
      const updated = await updateUser('00000000-0000-0000-0000-000000000000', {
        name: 'Test',
      });
      expect(updated).toBeNull();
    });
  });

  describe('suspendUser', () => {
    it('should set status to suspended', async () => {
      const user = await createUser('test@example.com', 'Test', 'student');
      const suspended = await suspendUser(user.id);

      expect(suspended?.status).toBe('suspended');
    });

    it('should return null if user not found', async () => {
      const result = await suspendUser('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('unsuspendUser', () => {
    it('should set status to active', async () => {
      const user = await createUser('test@example.com', 'Test', 'student');
      await suspendUser(user.id);
      const unsuspended = await unsuspendUser(user.id);

      expect(unsuspended?.status).toBe('active');
    });
  });
});
