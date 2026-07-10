import { describe, it, expect, beforeEach } from 'vitest';
import { signToken, verifyToken } from './jwt';
import * as jwt from 'jsonwebtoken';

describe('jwt', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  it('should sign a valid token', () => {
    const token = signToken('user123', 'admin');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify a valid token', () => {
    const token = signToken('user123', 'admin');
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user123');
    expect(result?.role).toBe('admin');
  });

  it('should return null for invalid token', () => {
    const result = verifyToken('invalid.token.here');
    expect(result).toBeNull();
  });

  it('should return null for expired token', () => {
    const secret = process.env.JWT_SECRET!;
    const expiredToken = jwt.sign(
      { userId: 'user123', role: 'admin' },
      secret,
      {
        expiresIn: '-1h',
        audience: 'school-portal',
      }
    );
    const result = verifyToken(expiredToken);
    expect(result).toBeNull();
  });
});
