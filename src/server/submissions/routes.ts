import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/plugin';
import { db } from '../db/client';
import {
  createSubmission,
  getSubmission,
  listSubmissionsByAssignment,
  listSubmissionsByStudent,
} from './submissions.service';

const submitSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
});

// POST /assignments/:assignmentId/submit - student submits for assignment.
async function submitHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { assignmentId } = request.params as { assignmentId: string };
  const { content } = submitSchema.parse(request.body);
  const studentId = request.user!.userId;

  const assignment = await db
    .selectFrom('assignments')
    .where('id', '=', assignmentId)
    .selectAll()
    .executeTakeFirst();

  if (!assignment) {
    reply.code(404).send({ error: 'Assignment not found' });
    return;
  }

  const enrollment = await db
    .selectFrom('enrollments')
    .where('class_id', '=', assignment.class_id)
    .where('student_id', '=', studentId)
    .selectAll()
    .executeTakeFirst();

  if (!enrollment) {
    reply.code(403).send({ error: 'Student not enrolled in this class' });
    return;
  }

  const submission = await createSubmission(
    assignmentId,
    studentId,
    content
  );

  reply.code(201).send(submission);
}

// GET /assignments/:assignmentId/submissions - teacher views submissions.
async function listSubmissionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { assignmentId } = request.params as { assignmentId: string };
  const userId = request.user!.userId;

  const assignment = await db
    .selectFrom('assignments')
    .where('id', '=', assignmentId)
    .selectAll()
    .executeTakeFirst();

  if (!assignment) {
    reply.code(404).send({ error: 'Assignment not found' });
    return;
  }

  const classRow = await db
    .selectFrom('classes')
    .where('id', '=', assignment.class_id)
    .selectAll()
    .executeTakeFirst();

  if (!classRow) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  const isTeacher = classRow.teacher_id === userId;
  const user = await db
    .selectFrom('users')
    .where('id', '=', userId)
    .selectAll()
    .executeTakeFirst();

  const isAdmin = user?.role === 'admin';

  if (!isTeacher && !isAdmin) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const submissions = await listSubmissionsByAssignment(assignmentId);
  reply.send(submissions);
}

// GET /submissions/mine - student lists their own submissions.
async function listMySubmissionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const studentId = request.user!.userId;
  const submissions = await listSubmissionsByStudent(studentId);
  reply.send(submissions);
}

// GET /submissions/:submissionId - student/teacher views submission.
async function getSubmissionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { submissionId } = request.params as { submissionId: string };
  const userId = request.user!.userId;

  const submission = await getSubmission(submissionId);

  if (!submission) {
    reply.code(404).send({ error: 'Submission not found' });
    return;
  }

  const assignment = await db
    .selectFrom('assignments')
    .where('id', '=', submission.assignment_id)
    .selectAll()
    .executeTakeFirst();

  if (!assignment) {
    reply.code(404).send({ error: 'Assignment not found' });
    return;
  }

  const classRow = await db
    .selectFrom('classes')
    .where('id', '=', assignment.class_id)
    .selectAll()
    .executeTakeFirst();

  if (!classRow) {
    reply.code(404).send({ error: 'Class not found' });
    return;
  }

  const isOwner = submission.student_id === userId;
  const isTeacher = classRow.teacher_id === userId;
  const user = await db
    .selectFrom('users')
    .where('id', '=', userId)
    .selectAll()
    .executeTakeFirst();

  const isAdmin = user?.role === 'admin';

  if (!isOwner && !isTeacher && !isAdmin) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  reply.send(submission);
}

// Register submission routes with Fastify.
export async function registerSubmissionsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post(
    '/assignments/:assignmentId/submit',
    { onRequest: [requireAuth, requireRole('student')] },
    submitHandler
  );

  fastify.get(
    '/assignments/:assignmentId/submissions',
    { onRequest: [requireAuth] },
    listSubmissionsHandler
  );

  fastify.get(
    '/submissions/mine',
    { onRequest: [requireAuth, requireRole('student')] },
    listMySubmissionsHandler
  );

  fastify.get(
    '/submissions/:submissionId',
    { onRequest: [requireAuth] },
    getSubmissionHandler
  );
}
