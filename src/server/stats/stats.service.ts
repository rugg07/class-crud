import type Redis from 'ioredis';
import { db } from '../db/client';
import { cacheLookup } from './cache';

const CACHE_TTL = 60;

// Retrieve global average grade across all submissions.
export async function getAverageGrades(redis: Redis): Promise<{
  average: number | null;
}> {
  return cacheLookup(redis, 'stats:average-grades', async () => {
    const result = await db
      .selectFrom('grades')
      .select((eb) => eb.fn.avg<number>('grade').as('average'))
      .executeTakeFirst();

    return {
      average: result?.average ?? null,
    };
  }, CACHE_TTL);
}

// Retrieve average grade for a specific class.
export async function getAverageGradesByClass(
  redis: Redis,
  classId: string
): Promise<{ classId: string; average: number | null }> {
  return cacheLookup(
    redis,
    `stats:average-grades:${classId}`,
    async () => {
      const result = await db
        .selectFrom('grades')
        .innerJoin('submissions', 'submissions.id', 'grades.submission_id')
        .innerJoin('assignments', 'assignments.id', 'submissions.assignment_id')
        .where('assignments.class_id', '=', classId)
        .select((eb) => eb.fn.avg<number>('grade').as('average'))
        .executeTakeFirst();

      return {
        classId,
        average: result?.average ?? null,
      };
    },
    CACHE_TTL
  );
}

// Retrieve all active teachers as distinct id/name pairs.
export async function getTeacherNames(redis: Redis): Promise<{
  teachers: { id: string; name: string }[];
}> {
  return cacheLookup(
    redis,
    'stats:teachers',
    async () => {
      const teachers = await db
        .selectFrom('users')
        .where('role', '=', 'teacher')
        .where('status', '=', 'active')
        .distinct()
        .select(['id', 'name'])
        .execute();

      return { teachers };
    },
    CACHE_TTL
  );
}

// Retrieve all active students as distinct id/name pairs.
export async function getStudentNames(redis: Redis): Promise<{
  students: { id: string; name: string }[];
}> {
  return cacheLookup(
    redis,
    'stats:students',
    async () => {
      const students = await db
        .selectFrom('users')
        .where('role', '=', 'student')
        .where('status', '=', 'active')
        .distinct()
        .select(['id', 'name'])
        .execute();

      return { students };
    },
    CACHE_TTL
  );
}

// Retrieve all classes with student counts per class.
export async function getClasses(redis: Redis): Promise<{
  classes: { id: string; name: string; teacher_id: string; student_count: number }[];
}> {
  return cacheLookup(
    redis,
    'stats:classes',
    async () => {
      const classes = await db
        .selectFrom('classes')
        .leftJoin('enrollments', 'enrollments.class_id', 'classes.id')
        .select([
          'classes.id',
          'classes.name',
          'classes.teacher_id',
          (eb) =>
            eb
              .fn.count<number>('enrollments.student_id')
              .distinct()
              .as('student_count'),
        ])
        .groupBy(['classes.id', 'classes.name', 'classes.teacher_id'])
        .execute();

      return {
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          teacher_id: c.teacher_id,
          student_count: Number(c.student_count),
        })),
      };
    },
    CACHE_TTL
  );
}

// Retrieve all students enrolled in a specific class.
export async function getClassStudents(
  redis: Redis,
  classId: string
): Promise<{
  classId: string;
  students: { id: string; name: string; email: string }[];
}> {
  return cacheLookup(
    redis,
    `stats:classes:${classId}:students`,
    async () => {
      const students = await db
        .selectFrom('enrollments')
        .innerJoin('users', 'users.id', 'enrollments.student_id')
        .where('enrollments.class_id', '=', classId)
        .select(['users.id', 'users.name', 'users.email'])
        .execute();

      return { classId, students };
    },
    CACHE_TTL
  );
}

// Clear Redis cache keys matching pattern (e.g., 'stats:*', 'stats:average-grades*').
export async function invalidateCache(
  redis: Redis,
  pattern?: string
): Promise<void> {
  const keyPattern = pattern || 'stats:*';
  const keys = await redis.keys(keyPattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Helper for cache invalidation called by other services (grades, enrollments).
export async function invalidateCachePatterns(
  redis: Redis,
  patterns: string[]
): Promise<void> {
  for (const pattern of patterns) {
    await invalidateCache(redis, pattern);
  }
}
