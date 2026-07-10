import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyToken } from './jwt';

// Extend FastifyRequest to include user info and cookies.
declare module 'fastify' {
  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
    user?: { userId: string; role: string };
  }

  interface FastifyInstance {
    requireAuth: typeof requireAuth;
    requireRole: typeof requireRole;
  }
}

// Verify JWT from 'session' cookie, set req.user or throw 401.
async function verifyJWT(request: FastifyRequest): Promise<void> {
  const token = request.cookies.session;
  if (!token) {
    throw new Error('Unauthorized');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    throw new Error('Unauthorized');
  }

  request.user = decoded;
}

// Middleware for Fastify hooks.
export const requireAuth = async (request: FastifyRequest): Promise<void> => {
  return verifyJWT(request);
};

// Check req.user.role is in allowed roles, throw 403 if not.
export function requireRole(...allowedRoles: string[]) {
  return async (
    request: FastifyRequest
  ): Promise<void> => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      throw new Error('Forbidden');
    }
  };
}

// Register auth hooks with Fastify instance.
export async function registerAuthPlugin(
  fastify: FastifyInstance
): Promise<void> {
  // Decorate with auth helpers (optional, for testing).
  fastify.decorate('requireAuth', requireAuth);
  fastify.decorate('requireRole', requireRole);
}
