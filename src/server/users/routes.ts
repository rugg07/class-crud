import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/plugin';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  suspendUser,
} from './users.service';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'teacher', 'student']),
  password: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

// GET /users - list all users with pagination.
async function listUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const query = request.query as { limit?: number | string; offset?: number | string };
  const limit = Math.min(
    Math.max(parseInt(String(query?.limit || 20), 10), 1),
    100
  );
  const offset = Math.max(parseInt(String(query?.offset || 0), 10), 0);

  const result = await listUsers(limit, offset);
  reply.code(200).send(result);
}

// POST /users - create new user.
async function createUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = createUserSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const user = await createUser(
    body.data.email,
    body.data.name,
    body.data.role,
    body.data.password
  );

  reply.code(201).send(user);
}

// GET /users/:id - fetch user by id.
async function getUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const user = await getUserById(id);
  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return;
  }

  reply.code(200).send(user);
}

// PATCH /users/:id - update user.
async function updateUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const body = updateUserSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const user = await updateUser(id, body.data);
  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return;
  }

  reply.code(200).send(user);
}

// DELETE /users/:id - soft-delete user by setting status to suspended.
async function deleteUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const user = await suspendUser(id);
  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return;
  }

  reply.code(200).send(user);
}

// Register users routes with Fastify instance.
export async function registerUsersRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get(
    '/users',
    { onRequest: [requireAuth, requireRole('admin')] },
    listUsersHandler
  );

  fastify.post(
    '/users',
    { onRequest: [requireAuth, requireRole('admin')] },
    createUserHandler
  );

  fastify.get(
    '/users/:id',
    { onRequest: [requireAuth, requireRole('admin')] },
    getUserHandler
  );

  fastify.patch(
    '/users/:id',
    { onRequest: [requireAuth, requireRole('admin')] },
    updateUserHandler
  );

  fastify.delete(
    '/users/:id',
    { onRequest: [requireAuth, requireRole('admin')] },
    deleteUserHandler
  );
}
