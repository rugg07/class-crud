import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { requireAuth } from '../auth/plugin';
import {
  getAverageGrades,
  getAverageGradesByClass,
  getTeacherNames,
  getStudentNames,
  getClasses,
  getClassStudents,
} from './stats.service';

// GET /api/v0/stats/average-grades - retrieve global average grade.
async function getAverageGradesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await getAverageGrades(redis);
  reply.code(200).send(result);
}

// GET /api/v0/stats/average-grades/:classId - retrieve class average grade.
async function getAverageGradesByClassHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId } = request.params as { classId: string };
  const result = await getAverageGradesByClass(redis, classId);
  reply.code(200).send(result);
}

// GET /api/v0/stats/teacher-names - retrieve all active teachers.
async function getTeacherNamesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await getTeacherNames(redis);
  reply.code(200).send(result);
}

// GET /api/v0/stats/student-names - retrieve all active students.
async function getStudentNamesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await getStudentNames(redis);
  reply.code(200).send(result);
}

// GET /api/v0/stats/classes - retrieve all classes with student counts.
async function getClassesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await getClasses(redis);
  reply.code(200).send(result);
}

// GET /api/v0/stats/classes/:classId - retrieve students enrolled in class.
async function getClassStudentsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { classId } = request.params as { classId: string };
  const result = await getClassStudents(redis, classId);
  reply.code(200).send(result);
}

// Register stats routes with Fastify instance.
export async function registerStatsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get('/api/v0/stats/average-grades', {
    onRequest: requireAuth,
    handler: getAverageGradesHandler,
  });

  fastify.get('/api/v0/stats/average-grades/:classId', {
    onRequest: requireAuth,
    handler: getAverageGradesByClassHandler,
  });

  fastify.get('/api/v0/stats/teacher-names', {
    onRequest: requireAuth,
    handler: getTeacherNamesHandler,
  });

  fastify.get('/api/v0/stats/student-names', {
    onRequest: requireAuth,
    handler: getStudentNamesHandler,
  });

  fastify.get('/api/v0/stats/classes', {
    onRequest: requireAuth,
    handler: getClassesHandler,
  });

  fastify.get('/api/v0/stats/classes/:classId', {
    onRequest: requireAuth,
    handler: getClassStudentsHandler,
  });
}
