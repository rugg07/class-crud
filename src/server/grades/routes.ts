import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/plugin';
import { db } from '../db/client';
import {
  recordGrade,
  getGradeForSubmission,
  getAllGradesForSubmission,
  getAllGradesForAssignment,
} from './grades.service';
import { getLatestVersion } from '../submissions/submissions.service';

const gradeSchema = z.object({
  grade: z.number().min(0).max(100),
  feedback: z.string().optional().default(''),
});

// POST /submissions/:submissionId/grade - teacher grades submission.
async function gradeSubmissionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { submissionId } = request.params as { submissionId: string };
  const { grade: gradeValue, feedback } = gradeSchema.parse(request.body);
  const teacherId = request.user!.userId;

  const submission = await db
    .selectFrom('submissions')
    .where('id', '=', submissionId)
    .selectAll()
    .executeTakeFirst();

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

  if (!classRow || classRow.teacher_id !== teacherId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const latestVersion = await getLatestVersion(submissionId);

  if (!latestVersion) {
    reply.code(404).send({ error: 'Submission version not found' });
    return;
  }

  const gradeRecord = await recordGrade(
    submissionId,
    latestVersion.id,
    gradeValue,
    feedback,
    teacherId
  );

  reply.code(201).send(gradeRecord);
}

// GET /submissions/:submissionId/grade - student/teacher views latest grade.
async function getGradeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { submissionId } = request.params as { submissionId: string };
  const userId = request.user!.userId;

  const submission = await db
    .selectFrom('submissions')
    .where('id', '=', submissionId)
    .selectAll()
    .executeTakeFirst();

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

  const grade = await getGradeForSubmission(submissionId);

  reply.send(grade || null);
}

// GET /submissions/:submissionId/grades - student/teacher views grade history.
async function getGradeHistoryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { submissionId } = request.params as { submissionId: string };
  const userId = request.user!.userId;

  const submission = await db
    .selectFrom('submissions')
    .where('id', '=', submissionId)
    .selectAll()
    .executeTakeFirst();

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

  const grades = await getAllGradesForSubmission(submissionId);

  reply.send(grades);
}

// GET /assignments/:assignmentId/grades - teacher views grades for assignment.
async function getAssignmentGradesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { assignmentId } = request.params as { assignmentId: string };
  const teacherId = request.user!.userId;

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

  if (!classRow || classRow.teacher_id !== teacherId) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  const grades = await getAllGradesForAssignment(assignmentId);

  reply.send(grades);
}

// Register grades routes with Fastify.
export async function registerGradesRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post(
    '/submissions/:submissionId/grade',
    { onRequest: [requireAuth, requireRole('teacher')] },
    gradeSubmissionHandler
  );

  fastify.get(
    '/submissions/:submissionId/grade',
    { onRequest: [requireAuth] },
    getGradeHandler
  );

  fastify.get(
    '/submissions/:submissionId/grades',
    { onRequest: [requireAuth] },
    getGradeHistoryHandler
  );

  fastify.get(
    '/assignments/:assignmentId/grades',
    { onRequest: [requireAuth, requireRole('teacher')] },
    getAssignmentGradesHandler
  );
}
