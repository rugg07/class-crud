import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/plugin';
import {
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addTeacherToGroup,
  removeTeacherFromGroup,
} from './groups.service';

const createGroupSchema = z.object({
  name: z.string().min(1),
});

const updateGroupSchema = z.object({
  name: z.string().optional(),
});

const addTeacherSchema = z.object({
  teacher_id: z.string(),
});

// GET /teacher-groups - list all teacher groups.
async function listGroupsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const groups = await listGroups();
  reply.code(200).send(groups);
}

// POST /teacher-groups - create new teacher group.
async function createGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = createGroupSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const group = await createGroup(body.data.name);
  reply.code(201).send(group);
}

// PATCH /teacher-groups/:id - update teacher group.
async function updateGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const body = updateGroupSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  if (!body.data.name) {
    reply.code(400).send({ error: 'Name is required' });
    return;
  }

  const group = await updateGroup(id, body.data.name);
  if (!group) {
    reply.code(404).send({ error: 'Group not found' });
    return;
  }

  reply.code(200).send(group);
}

// DELETE /teacher-groups/:id - delete teacher group.
async function deleteGroupHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const group = await getGroupById(id);
  if (!group) {
    reply.code(404).send({ error: 'Group not found' });
    return;
  }

  await deleteGroup(id);
  reply.code(200).send({ ok: true });
}

// POST /teacher-groups/:id/members - add teacher to group.
async function addTeacherHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const body = addTeacherSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const group = await getGroupById(id);
  if (!group) {
    reply.code(404).send({ error: 'Group not found' });
    return;
  }

  await addTeacherToGroup(id, body.data.teacher_id);
  reply.code(201).send({ ok: true });
}

// DELETE /teacher-groups/:id/members/:teacherId - remove teacher from group.
async function removeTeacherHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id, teacherId } = request.params as {
    id: string;
    teacherId: string;
  };

  const group = await getGroupById(id);
  if (!group) {
    reply.code(404).send({ error: 'Group not found' });
    return;
  }

  await removeTeacherFromGroup(id, teacherId);
  reply.code(200).send({ ok: true });
}

// Register teacher-groups routes with Fastify instance.
export async function registerTeacherGroupsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get(
    '/teacher-groups',
    { onRequest: [requireAuth, requireRole('admin')] },
    listGroupsHandler
  );

  fastify.post(
    '/teacher-groups',
    { onRequest: [requireAuth, requireRole('admin')] },
    createGroupHandler
  );

  fastify.patch(
    '/teacher-groups/:id',
    { onRequest: [requireAuth, requireRole('admin')] },
    updateGroupHandler
  );

  fastify.delete(
    '/teacher-groups/:id',
    { onRequest: [requireAuth, requireRole('admin')] },
    deleteGroupHandler
  );

  fastify.post(
    '/teacher-groups/:id/members',
    { onRequest: [requireAuth, requireRole('admin')] },
    addTeacherHandler
  );

  fastify.delete(
    '/teacher-groups/:id/members/:teacherId',
    { onRequest: [requireAuth, requireRole('admin')] },
    removeTeacherHandler
  );
}
