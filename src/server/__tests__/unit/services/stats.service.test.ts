import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import { db } from '../../../db/client';
import { redis } from '../../../redis';
import {
  getAverageGrades,
  getAverageGradesByClass,
  getTeacherNames,
  getStudentNames,
  getClasses,
  getClassStudents,
  invalidateCache,
  invalidateCachePatterns,
} from '../../../stats/stats.service';

let teacherId: string;
let studentId: string;
let classId: string;
let _assignmentId: string;
let _submissionId: string;

beforeAll(async () => {
  // Migrations should already be run; just ensure db is available.
});

beforeEach(async () => {
  // Clean up all tables.
  await db.deleteFrom('grades').execute();
  await db.deleteFrom('submission_versions').execute();
  await db.deleteFrom('submissions').execute();
  await db.deleteFrom('assignments').execute();
  await db.deleteFrom('enrollments').execute();
  await db.deleteFrom('classes').execute();
  await db.deleteFrom('users').execute();

  // Clear Redis cache.
  await redis.flushdb();

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
      published_at: new Date().toISOString(),
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
      submitted_at: new Date().toISOString(),
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
      grade: 85,
      feedback: 'Good work',
      graded_by: teacher!.id,
      graded_at: new Date(),
    })
    .execute();

  teacherId = teacher!.id;
  studentId = student!.id;
  classId = newClass!.id;
  _assignmentId = assignment!.id;
  _submissionId = submission!.id;
});

afterAll(async () => {
  await redis.disconnect();
  await db.destroy();
});

describe('getAverageGrades', () => {
  it('returns average grade across all submissions', async () => {
    const result = await getAverageGrades(redis);
    expect(result.average).toBe(85);
  });

  it('caches result in Redis', async () => {
    const firstCall = await getAverageGrades(redis);
    const cached = await redis.get('stats:average-grades');
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!)).toEqual(firstCall);
  });

  it('returns cached result on second call', async () => {
    const firstCall = await getAverageGrades(redis);
    const secondCall = await getAverageGrades(redis);
    expect(secondCall).toEqual(firstCall);
  });
});

describe('getAverageGradesByClass', () => {
  it('returns average grade for a specific class', async () => {
    const result = await getAverageGradesByClass(redis, classId);
    expect(result.classId).toBe(classId);
    expect(result.average).toBe(85);
  });

  it('caches result in Redis with class-specific key', async () => {
    await getAverageGradesByClass(redis, classId);
    const cached = await redis.get(`stats:average-grades:${classId}`);
    expect(cached).toBeTruthy();
  });

  it('returns null average when class has no grades', async () => {
    const emptyClassId = await db
      .insertInto('classes')
      .values({ teacher_id: teacherId, name: 'Empty Class' })
      .returningAll()
      .executeTakeFirst()
      .then((c) => c!.id);

    const result = await getAverageGradesByClass(redis, emptyClassId);
    expect(result.average).toBeNull();
  });
});

describe('getTeacherNames', () => {
  it('returns all active teachers', async () => {
    const result = await getTeacherNames(redis);
    expect(result.teachers).toHaveLength(1);
    expect(result.teachers[0]).toEqual({
      id: teacherId,
      name: 'Teacher One',
    });
  });

  it('excludes suspended teachers', async () => {
    await db
      .updateTable('users')
      .set({ status: 'suspended' })
      .where('id', '=', teacherId)
      .execute();

    // Clear cache to force re-fetch.
    await invalidateCache(redis, 'stats:teachers');

    const result = await getTeacherNames(redis);
    expect(result.teachers).toHaveLength(0);
  });

  it('caches result in Redis', async () => {
    await getTeacherNames(redis);
    const cached = await redis.get('stats:teachers');
    expect(cached).toBeTruthy();
  });
});

describe('getStudentNames', () => {
  it('returns all active students', async () => {
    const result = await getStudentNames(redis);
    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toEqual({
      id: studentId,
      name: 'Student One',
    });
  });

  it('excludes suspended students', async () => {
    await db
      .updateTable('users')
      .set({ status: 'suspended' })
      .where('id', '=', studentId)
      .execute();

    // Clear cache to force re-fetch.
    await invalidateCache(redis, 'stats:students');

    const result = await getStudentNames(redis);
    expect(result.students).toHaveLength(0);
  });

  it('caches result in Redis', async () => {
    await getStudentNames(redis);
    const cached = await redis.get('stats:students');
    expect(cached).toBeTruthy();
  });
});

describe('getClasses', () => {
  it('returns all classes with student counts', async () => {
    const result = await getClasses(redis);
    expect(result.classes).toHaveLength(1);
    expect(result.classes[0]).toEqual({
      id: classId,
      name: 'Math 101',
      teacher_id: teacherId,
      student_count: 1,
    });
  });

  it('counts students correctly for multiple enrollments', async () => {
    const student2 = await db
      .insertInto('users')
      .values({
        email: 'student2@example.com',
        password_hash: 'hash',
        name: 'Student Two',
        role: 'student',
        status: 'active',
      })
      .returningAll()
      .executeTakeFirst();

    await db
      .insertInto('enrollments')
      .values({ class_id: classId, student_id: student2!.id })
      .execute();

    // Clear cache to force re-fetch.
    await invalidateCache(redis, 'stats:classes');

    const result = await getClasses(redis);
    expect(result.classes[0]?.student_count).toBe(2);
  });

  it('caches result in Redis', async () => {
    await getClasses(redis);
    const cached = await redis.get('stats:classes');
    expect(cached).toBeTruthy();
  });
});

describe('getClassStudents', () => {
  it('returns all students enrolled in a class', async () => {
    const result = await getClassStudents(redis, classId);
    expect(result.classId).toBe(classId);
    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toEqual({
      id: studentId,
      name: 'Student One',
      email: 'student@example.com',
    });
  });

  it('caches result in Redis with class-specific key', async () => {
    await getClassStudents(redis, classId);
    const cached = await redis.get(`stats:classes:${classId}:students`);
    expect(cached).toBeTruthy();
  });

  it('returns empty list when class has no students', async () => {
    const emptyClassId = await db
      .insertInto('classes')
      .values({ teacher_id: teacherId, name: 'Empty Class' })
      .returningAll()
      .executeTakeFirst()
      .then((c) => c!.id);

    const result = await getClassStudents(redis, emptyClassId);
    expect(result.students).toHaveLength(0);
  });
});

describe('invalidateCache', () => {
  it('clears cache with exact key', async () => {
    await getAverageGrades(redis);
    await invalidateCache(redis, 'stats:average-grades');
    const cached = await redis.get('stats:average-grades');
    expect(cached).toBeNull();
  });

  it('clears cache with pattern', async () => {
    await getAverageGrades(redis);
    await getAverageGradesByClass(redis, classId);
    await invalidateCache(redis, 'stats:average-grades*');

    const cached1 = await redis.get('stats:average-grades');
    const cached2 = await redis.get(`stats:average-grades:${classId}`);
    expect(cached1).toBeNull();
    expect(cached2).toBeNull();
  });

  it('clears all cache with wildcard pattern', async () => {
    await getAverageGrades(redis);
    await getTeacherNames(redis);
    await getClasses(redis);
    await invalidateCache(redis, 'stats:*');

    const keys = await redis.keys('stats:*');
    expect(keys).toHaveLength(0);
  });
});

describe('invalidateCachePatterns', () => {
  it('clears multiple cache patterns', async () => {
    await getAverageGrades(redis);
    await getTeacherNames(redis);
    await getClasses(redis);

    await invalidateCachePatterns(redis, [
      'stats:average-grades*',
      'stats:teachers',
    ]);

    const cached1 = await redis.get('stats:average-grades');
    const cached2 = await redis.get('stats:teachers');
    const cached3 = await redis.get('stats:classes');

    expect(cached1).toBeNull();
    expect(cached2).toBeNull();
    expect(cached3).toBeTruthy();
  });
});
