import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import FastifyCookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { db } from '../../../db/client';
import { redis } from '../../../redis';
import { registerAuthPlugin } from '../../../auth/plugin';
import { signToken } from '../../../auth/jwt';
import { registerStatsRoutes } from '../../../stats/routes';
import { invalidateCache } from '../../../stats/stats.service';

let fastify: FastifyInstance;
let token: string;
let userId: string;
let _teacherId: string;
let _studentId: string;
let classId: string;

beforeAll(async () => {
  // Initialize Fastify.
  fastify = Fastify();
  await fastify.register(FastifyCookie);
  await registerAuthPlugin(fastify);
  await registerStatsRoutes(fastify);

  // Note: Migrations must be run separately before tests.
});

beforeEach(async () => {
  // Clear cache and tables.
  await invalidateCache(redis, 'stats:*');
  await db.deleteFrom('grades').execute();
  await db.deleteFrom('submission_versions').execute();
  await db.deleteFrom('submissions').execute();
  await db.deleteFrom('assignments').execute();
  await db.deleteFrom('enrollments').execute();
  await db.deleteFrom('classes').execute();
  await db.deleteFrom('users').execute();

  // Create test user for auth.
  const authUser = await db
    .insertInto('users')
    .values({
      email: 'auth@example.com',
      password_hash: 'hash',
      name: 'Auth User',
      role: 'student',
      status: 'active',
    })
    .returningAll()
    .executeTakeFirst();

  userId = authUser!.id;
  token = signToken(userId, 'student');

  // Create test data.
  const teacher = await db
    .insertInto('users')
    .values({
      email: 'teacher@example.com',
      password_hash: 'hash',
      name: 'Teacher One',
      role: 'teacher',
      status: 'active',
    })
    .returningAll()
    .executeTakeFirst();

  const student = await db
    .insertInto('users')
    .values({
      email: 'student@example.com',
      password_hash: 'hash',
      name: 'Student One',
      role: 'student',
      status: 'active',
    })
    .returningAll()
    .executeTakeFirst();

  const newClass = await db
    .insertInto('classes')
    .values({
      teacher_id: teacher!.id,
      name: 'Math 101',
    })
    .returningAll()
    .executeTakeFirst();

  await db
    .insertInto('enrollments')
    .values({
      class_id: newClass!.id,
      student_id: student!.id,
    })
    .execute();

  const assignment = await db
    .insertInto('assignments')
    .values({
      class_id: newClass!.id,
      title: 'Quiz 1',
      description: null,
      due_at: null,
      published_at: new Date(),
      max_points: 100,
    })
    .returningAll()
    .executeTakeFirst();

  const submission = await db
    .insertInto('submissions')
    .values({
      assignment_id: assignment!.id,
      student_id: student!.id,
    })
    .returningAll()
    .executeTakeFirst();

  const version = await db
    .insertInto('submission_versions')
    .values({
      submission_id: submission!.id,
      version_number: 1,
      content: 'student answer',
      submitted_at: new Date(),
      file_url: null,
      file_name: null,
      mime_type: null,
      file_size: null,
    })
    .returningAll()
    .executeTakeFirst();

  await db
    .insertInto('grades')
    .values({
      submission_id: submission!.id,
      graded_version_id: version!.id,
      grade: 90,
      feedback: 'Excellent',
      graded_by: teacher!.id,
      graded_at: new Date(),
    })
    .execute();

  _teacherId = teacher!.id;
  _studentId = student!.id;
  classId = newClass!.id;
});

afterAll(async () => {
  await redis.disconnect();
  await db.destroy();
  await fastify.close();
});

describe('Stats Routes', () => {
  it('GET /api/v0/stats/average-grades returns average grade', async () => {
    const res = await request(fastify.server)
      .get('/api/v0/stats/average-grades')
      .set('Cookie', [`session=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('average');
    expect(res.body.average).toBe(90);
  });

  it('GET /api/v0/stats/average-grades requires auth', async () => {
    const res = await request(fastify.server).get(
      '/api/v0/stats/average-grades'
    );

    expect(res.status).toBe(500); // Unauthorized throws error
  });

  it('GET /api/v0/stats/average-grades/:classId returns class average', async () => {
    const res = await request(fastify.server)
      .get(`/api/v0/stats/average-grades/${classId}`)
      .set('Cookie', [`session=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.classId).toBe(classId);
    expect(res.body.average).toBe(90);
  });

  it('GET /api/v0/stats/teacher-names returns teachers', async () => {
    const res = await request(fastify.server)
      .get('/api/v0/stats/teacher-names')
      .set('Cookie', [`session=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('teachers');
    expect(res.body.teachers).toHaveLength(1);
    expect(res.body.teachers[0].name).toBe('Teacher One');
  });

  it('GET /api/v0/stats/student-names returns students', async () => {
    const res = await request(fastify.server)
      .get('/api/v0/stats/student-names')
      .set('Cookie', [`session=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('students');
    expect(res.body.students.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.students.some(
        (s: { id: string; name: string }) => s.name === 'Student One'
      )
    ).toBe(true);
  });

  it('GET /api/v0/stats/classes returns classes with student counts', async () => {
    const res = await request(fastify.server)
      .get('/api/v0/stats/classes')
      .set('Cookie', [`session=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('classes');
    expect(res.body.classes).toHaveLength(1);
    expect(res.body.classes[0].name).toBe('Math 101');
    expect(res.body.classes[0].student_count).toBe(1);
  });

  it('GET /api/v0/stats/classes/:classId returns class students', async () => {
    const res = await request(fastify.server)
      .get(`/api/v0/stats/classes/${classId}`)
      .set('Cookie', [`session=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.classId).toBe(classId);
    expect(res.body).toHaveProperty('students');
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].name).toBe('Student One');
    expect(res.body.students[0].email).toBe('student@example.com');
  });

  it('requires valid JWT for all endpoints', async () => {
    const endpoints = [
      '/api/v0/stats/average-grades',
      '/api/v0/stats/teacher-names',
      '/api/v0/stats/student-names',
      '/api/v0/stats/classes',
    ];

    for (const endpoint of endpoints) {
      const res = await request(fastify.server).get(endpoint);

      expect(res.status).toBe(500); // Unauthorized throws error
    }
  });
});
