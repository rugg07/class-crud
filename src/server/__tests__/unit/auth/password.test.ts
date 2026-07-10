import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../../auth/password';

describe('password', () => {
  it('should hash password', () => {
    const password = 'mySecurePassword123';
    const hash = hashPassword(password);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toContain(':');
  });

  it('should verify correct password', () => {
    const password = 'mySecurePassword123';
    const hash = hashPassword(password);
    const result = verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('should reject wrong password', () => {
    const password = 'mySecurePassword123';
    const hash = hashPassword(password);
    const result = verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('should handle timing-safe comparison without error', () => {
    const password = 'mySecurePassword123';
    const hash = hashPassword(password);
    expect(() => {
      verifyPassword(password, hash);
      verifyPassword('wrongPassword', hash);
    }).not.toThrow();
  });
});
