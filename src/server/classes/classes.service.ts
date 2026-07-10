import { db } from '../db/client';
import type { Class, User } from '../db/types';

// Fetch all classes taught by a teacher.
export async function listClassesByTeacher(
  teacherId: string
): Promise<Class[]> {
  const classes = await db
    .selectFrom('classes')
    .where('teacher_id', '=', teacherId)
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();

  return classes;
}

// Fetch all classes (admin use).
export async function listAllClasses(): Promise<Class[]> {
  const classes = await db
    .selectFrom('classes')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();

  return classes;
}

// Fetch class by ID.
export async function getClassById(id: string): Promise<Class | null> {
  const klass = await db
    .selectFrom('classes')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();

  return klass || null;
}

// Create new class for teacher.
export async function createClass(
  name: string,
  teacherId: string
): Promise<Class> {
  const klass = await db
    .insertInto('classes')
    .values({ name, teacher_id: teacherId })
    .returningAll()
    .executeTakeFirstOrThrow();

  return klass;
}

// Update class name.
export async function updateClass(
  id: string,
  name: string
): Promise<Class | null> {
  const klass = await db
    .updateTable('classes')
    .set({ name })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return klass || null;
}

// Delete class (cascade enrollments).
export async function deleteClass(id: string): Promise<void> {
  await db.deleteFrom('enrollments').where('class_id', '=', id).execute();
  await db.deleteFrom('classes').where('id', '=', id).execute();
}

// Enroll student in class (validate first).
export async function enrollStudent(
  classId: string,
  studentId: string
): Promise<void> {
  const klass = await getClassById(classId);
  if (!klass) {
    throw new Error('Class not found');
  }

  const student = await db
    .selectFrom('users')
    .where('id', '=', studentId)
    .selectAll()
    .executeTakeFirst();
  if (!student) {
    throw new Error('Student not found');
  }

  const existing = await db
    .selectFrom('enrollments')
    .where('class_id', '=', classId)
    .where('student_id', '=', studentId)
    .selectAll()
    .executeTakeFirst();
  if (existing) {
    throw new Error('Student already enrolled');
  }

  await db
    .insertInto('enrollments')
    .values({ class_id: classId, student_id: studentId })
    .execute();
}

// Remove student from class.
export async function removeStudent(
  classId: string,
  studentId: string
): Promise<void> {
  await db
    .deleteFrom('enrollments')
    .where('class_id', '=', classId)
    .where('student_id', '=', studentId)
    .execute();
}

// Fetch all enrolled students for a class (including suspended).
export async function getClassStudents(classId: string): Promise<User[]> {
  const students = await db
    .selectFrom('users')
    .where('id', 'in',
      db.selectFrom('enrollments')
        .select('student_id')
        .where('class_id', '=', classId))
    .selectAll()
    .orderBy('name', 'asc')
    .execute();

  return students;
}
