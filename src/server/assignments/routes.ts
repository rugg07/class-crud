import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/plugin';
import {
  listAssignmentsByClass,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  publishAssignment,
  deleteAssignment,
} from './assignments.service';
import { getClassById } from '../classes/classes.service';
import { db } from '../db/client';

const createAssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  due_at: z.string().datetime().optional(),
});

const updateAssignmentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  due_at: z.string().datetime().optional(),
});

// GET /classes/:classId/assignments - list assignments (teacher sees all, student sees published).
async function listAssignmentsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId } = request.params as { classId: string };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(classId);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  const isTeacher = klass.teacher_id === user.userId;
  const isAdmin = user.role === 'admin';

  if (!isTeacher && !isAdmin) {
    const isStudent = (
      await db
        .selectFrom('enrollments')
        .where('class_id', '=', classId)
        .where('student_id', '=', user.userId)
        .selectAll()
        .executeTakeFirst()
    ) !== undefined;

    if (!isStudent) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
  }

  let assignments = await listAssignmentsByClass(classId);

  if (!isTeacher && !isAdmin) {
    assignments = assignments.filter((a) => a.published_at !== null);
  }

  reply.code(200).send(assignments);
}

// POST /classes/:classId/assignments - create assignment (teacher only).
async function createAssignmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId } = request.params as { classId: string };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(classId);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const body = createAssignmentSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const due_at = body.data.due_at ? new Date(body.data.due_at) : null;
  const assignment = await createAssignment(
    classId,
    body.data.title,
    body.data.description || null,
    due_at
  );

  reply.code(201).send(assignment);
}

// PATCH /classes/:classId/assignments/:assignmentId - update assignment.
async function updateAssignmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId, assignmentId } = request.params as {
    classId: string;
    assignmentId: string;
  };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(classId);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment || assignment.class_id !== classId) {
    reply.code(404).send({ error: 'Assignment not found' });
    return;
  }

  const body = updateAssignmentSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const updates: { title?: string; description?: string; due_at?: Date | null } = {};
  if (body.data.title) updates.title = body.data.title;
  if (body.data.description !== undefined)
    updates.description = body.data.description || undefined;
  if (body.data.due_at !== undefined)
    updates.due_at = body.data.due_at ? new Date(body.data.due_at) : null;

  const updated = await updateAssignment(assignmentId, updates);
  reply.code(200).send(updated);
}

// POST /classes/:classId/assignments/:assignmentId/publish - publish assignment.
async function publishAssignmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId, assignmentId } = request.params as {
    classId: string;
    assignmentId: string;
  };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(classId);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment || assignment.class_id !== classId) {
    reply.code(404).send({ error: 'Assignment not found' });
    return;
  }

  const published = await publishAssignment(assignmentId);
  reply.code(200).send(published);
}

// DELETE /classes/:classId/assignments/:assignmentId - delete assignment.
async function deleteAssignmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId, assignmentId } = request.params as {
    classId: string;
    assignmentId: string;
  };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(classId);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment || assignment.class_id !== classId) {
    reply.code(404).send({ error: 'Assignment not found' });
    return;
  }

  await deleteAssignment(assignmentId);
  reply.code(200).send({ ok: true });
}

// Register assignments routes with Fastify instance.
export async function registerAssignmentsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get(
    '/classes/:classId/assignments',
    { onRequest: [requireAuth] },
    listAssignmentsHandler
  );

  fastify.post(
    '/classes/:classId/assignments',
    { onRequest: [requireAuth, requireRole('teacher')] },
    createAssignmentHandler
  );

  fastify.patch(
    '/classes/:classId/assignments/:assignmentId',
    { onRequest: [requireAuth, requireRole('teacher')] },
    updateAssignmentHandler
  );

  fastify.post(
    '/classes/:classId/assignments/:assignmentId/publish',
    { onRequest: [requireAuth, requireRole('teacher')] },
    publishAssignmentHandler
  );

  fastify.delete(
    '/classes/:classId/assignments/:assignmentId',
    { onRequest: [requireAuth, requireRole('teacher')] },
    deleteAssignmentHandler
  );
}
