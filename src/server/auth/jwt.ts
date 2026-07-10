import * as jwt from 'jsonwebtoken';

// Sign JWT with userId and role, expires in 24h, audience 'school-portal'.
export function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    { userId, role },
    secret,
    {
      expiresIn: '24h',
      audience: 'school-portal',
    }
  );
}

// Verify and decode token, return userId and role or null if invalid/expired.
export function verifyToken(
  token: string
): { userId: string; role: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      audience: 'school-portal',
    }) as { userId: string; role: string };
    return decoded;
  } catch {
    return null;
  }
}
