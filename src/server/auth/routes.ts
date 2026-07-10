import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { env } from '../env';
import { redis } from '../redis';
import { loginWithPassword, loginWithGoogle } from './auth.service';
import { getGoogleAuthUrl } from './oauth';


// Zod schema for login endpoint.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Zod schema for oauth callback.
const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

// POST /auth/login - verify credentials, set session cookie, return user + token.
async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = loginSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const result = await loginWithPassword(body.data.email, body.data.password);
  if (!result) {
    reply.code(401).send({ error: 'Invalid credentials' });
    return;
  }

  reply.setCookie('session', result.token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  reply.code(200).send({
    user: result.user,
    token: result.token,
  });
}

// GET /auth/google/authorize - return Google OAuth consent URL, store state in Redis.
async function googleAuthorizeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const state = Math.random().toString(36).substring(2, 15);
  await redis.setex(`oauth:state:${state}`, 300, 'pending');

  const url = getGoogleAuthUrl(state);
  reply.code(200).send({ url });
}

// GET /auth/google/callback - verify state, exchange code, lookup user, set cookie.
async function googleCallbackHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const query = callbackSchema.safeParse(request.query);
  if (!query.success) {
    reply.code(400).send({ error: 'Invalid query parameters' });
    return;
  }

  const stateExists = await redis.get(`oauth:state:${query.data.state}`);
  if (!stateExists) {
    reply.code(400).send({ error: 'Invalid state' });
    return;
  }

  await redis.del(`oauth:state:${query.data.state}`);

  const result = await loginWithGoogle(query.data.code);
  if (!result) {
    reply.code(403).send({ error: 'User not found' });
    return;
  }

  reply.setCookie('session', result.token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  reply.redirect('/dashboard');
}

// POST /auth/logout - clear session cookie.
async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.clearCookie('session');
  reply.code(200).send({ ok: true });
}

// Register auth routes with Fastify instance.
export async function registerAuthRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post('/auth/login', loginHandler);
  fastify.get('/auth/google/authorize', googleAuthorizeHandler);
  fastify.get('/auth/google/callback', googleCallbackHandler);
  fastify.post('/auth/logout', logoutHandler);
}
