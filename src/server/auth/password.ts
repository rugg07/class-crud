import * as crypto from 'crypto';

// Hash password with random 32-byte salt using scryptSync, returns "salt:hash" in base64.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32);
  const hash = crypto.scryptSync(password, salt, 64, { N: 64 });
  return salt.toString('base64') + ':' + hash.toString('base64');
}

// Verify password against stored hash using constant-time comparison.
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const saltBase64 = parts[0];
  const hashBase64 = parts[1];
  if (!saltBase64 || !hashBase64) return false;
  const salt = Buffer.from(saltBase64, 'base64');
  const hash = crypto.scryptSync(password, salt, 64, { N: 64 });
  const storedHash = Buffer.from(hashBase64, 'base64');
  return crypto.timingSafeEqual(hash, storedHash);
}
