import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/plugin';
import {
  listClassesByTeacher,
  listAllClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  enrollStudent,
  removeStudent,
  getClassStudents,
} from './classes.service';

const createClassSchema = z.object({
  name: z.string().min(1),
});

const updateClassSchema = z.object({
  name: z.string().optional(),
});

const enrollStudentSchema = z.object({
  student_id: z.string(),
});

// GET /classes - list classes visible to user.
async function listClassesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  let classes;
  if (user.role === 'admin') {
    classes = await listAllClasses();
  } else if (user.role === 'teacher') {
    classes = await listClassesByTeacher(user.userId);
  } else {
    // Student: list enrolled classes
    const enrollments = await require('../db/client').db
      .selectFrom('enrollments')
      .innerJoin('classes', 'classes.id', 'enrollments.class_id')
      .where('enrollments.student_id', '=', user.userId)
      .select('classes.*')
      .orderBy('classes.created_at', 'desc')
      .execute();
    classes = enrollments;
  }

  reply.code(200).send(classes);
}

// POST /classes - create class for teacher.
async function createClassHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const body = createClassSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  const klass = await createClass(body.data.name, user.userId);
  reply.code(201).send(klass);
}

// GET /classes/:id - fetch class (any authenticated role).
async function getClassHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const klass = await getClassById(id);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  reply.code(200).send(klass);
}

// PATCH /classes/:id - update class if owner or admin.
async function updateClassHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(id);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (user.role !== 'admin' && klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const body = updateClassSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  if (!body.data.name) {
    reply.code(400).send({ error: 'Name is required' });
    return;
  }

  const updated = await updateClass(id, body.data.name);
  reply.code(200).send(updated);
}

// DELETE /classes/:id - delete if owner or admin.
async function deleteClassHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(id);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (user.role !== 'admin' && klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  await deleteClass(id);
  reply.code(200).send({ ok: true });
}

// GET /classes/:id/students - fetch enrolled students.
async function getStudentsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(id);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  const isTeacher = klass.teacher_id === user.userId;
  const isAdmin = user.role === 'admin';

  if (!isTeacher && !isAdmin) {
    const isStudent = (
      await require('../db/client').db
        .selectFrom('enrollments')
        .where('class_id', '=', id)
        .where('student_id', '=', user.userId)
        .selectAll()
        .executeTakeFirst()
    ) !== undefined;

    if (!isStudent) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
  }

  const students = await getClassStudents(id);
  reply.code(200).send(students);
}

// POST /classes/:id/enroll - add student (teacher or admin).
async function enrollStudentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(id);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (user.role !== 'admin' && klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const body = enrollStudentSchema.safeParse(request.body);
  if (!body.success) {
    reply.code(400).send({ error: 'Invalid input' });
    return;
  }

  try {
    await enrollStudent(id, body.data.student_id);
    reply.code(201).send({ ok: true });
  } catch (err: any) {
    if (
      err.message === 'Class not found' ||
      err.message === 'Student not found'
    ) {
      reply.code(404).send({ error: err.message });
    } else if (err.message === 'Student already enrolled') {
      reply.code(400).send({ error: err.message });
    } else {
      reply.code(500).send({ error: 'Internal server error' });
    }
  }
}

// DELETE /classes/:id/students/:studentId - remove enrollment.
async function removeStudentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id, studentId } = request.params as {
    id: string;
    studentId: string;
  };
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const klass = await getClassById(id);
  if (!klass) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  if (user.role !== 'admin' && klass.teacher_id !== user.userId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  await removeStudent(id, studentId);
  reply.code(200).send({ ok: true });
}

// Register classes routes with Fastify instance.
export async function registerClassesRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get('/classes', { onRequest: [requireAuth] }, listClassesHandler);

  fastify.post(
    '/classes',
    { onRequest: [requireAuth, requireRole('teacher')] },
    createClassHandler
  );

  fastify.get('/classes/:id', { onRequest: [requireAuth] }, getClassHandler);

  fastify.patch(
    '/classes/:id',
    { onRequest: [requireAuth] },
    updateClassHandler
  );

  fastify.delete(
    '/classes/:id',
    { onRequest: [requireAuth] },
    deleteClassHandler
  );

  fastify.get(
    '/classes/:id/students',
    { onRequest: [requireAuth] },
    getStudentsHandler
  );

  fastify.post(
    '/classes/:id/enroll',
    { onRequest: [requireAuth, requireRole('teacher', 'admin')] },
    enrollStudentHandler
  );

  fastify.delete(
    '/classes/:id/students/:studentId',
    { onRequest: [requireAuth, requireRole('teacher', 'admin')] },
    removeStudentHandler
  );
}
