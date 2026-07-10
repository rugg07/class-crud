import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import FastifyCookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import request from 'supertest';
import { db } from '../db/client';
import { registerAuthRoutes } from './routes';
import { createUser } from './auth.service';
import { env } from '../env';
import type { User } from '../db/types';

let fastify: FastifyInstance;
let redis: Redis;
let testUser: User;

beforeAll(async () => {
  redis = new Redis(env.REDIS_URL);
  fastify = Fastify();
  await fastify.register(FastifyCookie);
  await registerAuthRoutes(fastify);

  // Note: Migrations must be run separately before tests.
});

beforeEach(async () => {
  // Clean up.
  await db.deleteFrom('users').execute();
  await redis.flushdb();

  // Create test user.
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
  await fastify.close();
  await db.destroy();
  redis.disconnect();
});

describe('POST /auth/login', () => {
  it('returns 200 with valid credentials and sets httpOnly cookie', async () => {
    const res = await request(fastify.server)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.user?.email).toBe('test@example.com');
    expect(res.body.token).toBeTruthy();
    expect(res.headers['set-cookie']).toBeDefined();
    const setCookie = res.headers['set-cookie'];
    expect(setCookie?.[0]).toContain('session=');
    expect(setCookie?.[0]).toContain('HttpOnly');
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(fastify.server)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
  });

  it('returns 401 with unknown email', async () => {
    const res = await request(fastify.server)
      .post('/auth/login')
      .send({
        email: 'unknown@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(401);
  });

  it('returns 400 with invalid email format', async () => {
    const res = await request(fastify.server)
      .post('/auth/login')
      .send({
        email: 'not-an-email',
        password: 'password123',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 with password too short', async () => {
    const res = await request(fastify.server)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'short',
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /auth/google/authorize', () => {
  it('returns 200 with Google OAuth URL', async () => {
    const res = await request(fastify.server).get('/auth/google/authorize');

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('accounts.google.com');
    expect(res.body.url).toContain('client_id=');
    expect(res.body.url).toContain('state=');
  });

  it('stores state in Redis with 5-min TTL', async () => {
    const res = await request(fastify.server).get('/auth/google/authorize');

    expect(res.status).toBe(200);
    const stateParam = new URL(res.body.url).searchParams.get('state');
    expect(stateParam).toBeTruthy();

    const stateExists = await redis.get(`oauth:state:${stateParam}`);
    expect(stateExists).toBe('pending');

    const ttl = await redis.ttl(`oauth:state:${stateParam}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });
});

describe('GET /auth/google/callback', () => {
  it('returns 400 if state is invalid', async () => {
    const res = await request(fastify.server)
      .get('/auth/google/callback')
      .query({
        code: 'fake-code',
        state: 'invalid-state',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid state');
  });

  it('returns 400 if query params are missing', async () => {
    const res = await request(fastify.server).get('/auth/google/callback');

    expect(res.status).toBe(400);
  });

  it('returns 403 if user not found', async () => {
    // Store a valid state.
    const state = 'valid-state-123';
    await redis.setex(`oauth:state:${state}`, 300, 'pending');

    const res = await request(fastify.server)
      .get('/auth/google/callback')
      .query({
        code: 'fake-code',
        state,
      });

    expect(res.status).toBe(403);
  });
});

describe('POST /auth/logout', () => {
  it('returns 200 and clears session cookie', async () => {
    // First login to set cookie.
    const loginRes = await request(fastify.server)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(loginRes.status).toBe(200);

    // Then logout.
    const logoutRes = await request(fastify.server).post('/auth/logout');

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.ok).toBe(true);
    expect(logoutRes.headers['set-cookie']).toBeDefined();
    const setCookie = logoutRes.headers['set-cookie'];
    expect(setCookie?.[0]).toContain('session=');
    expect(setCookie?.[0]).toContain('Max-Age=0');
  });
});
