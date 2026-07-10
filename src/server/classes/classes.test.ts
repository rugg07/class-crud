import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/client';
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

describe('Classes Service', () => {
  let teacherId: string;
  let studentId: string;

  beforeEach(async () => {
    // Clean up in order of FK dependencies
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('enrollments').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('teacher_group_members').execute();
    await db.deleteFrom('teacher_groups').execute();
    await db.deleteFrom('users').execute();

    const teacher = await db
      .insertInto('users')
      .values({
        email: 'teacher@example.com',
        name: 'Teacher',
        role: 'teacher',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    teacherId = teacher.id;

    const student = await db
      .insertInto('users')
      .values({
        email: 'student@example.com',
        name: 'Student',
        role: 'student',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    studentId = student.id;
  });

  afterEach(async () => {
    // Clean up in order of FK dependencies
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('enrollments').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('teacher_group_members').execute();
    await db.deleteFrom('teacher_groups').execute();
    await db.deleteFrom('users').execute();
  });

  describe('createClass', () => {
    it('should create a class for teacher', async () => {
      const klass = await createClass('Math 101', teacherId);

      expect(klass.name).toBe('Math 101');
      expect(klass.teacher_id).toBe(teacherId);
    });
  });

  describe('listClassesByTeacher', () => {
    it('should list classes for teacher', async () => {
      await createClass('Math', teacherId);
      await createClass('Science', teacherId);

      const classes = await listClassesByTeacher(teacherId);

      expect(classes).toHaveLength(2);
      expect(classes.map((c) => c.name)).toContain('Math');
    });
  });

  describe('listAllClasses', () => {
    it('should list all classes', async () => {
      await createClass('Math', teacherId);
      await createClass('Science', teacherId);

      const classes = await listAllClasses();

      expect(classes).toHaveLength(2);
    });
  });

  describe('getClassById', () => {
    it('should fetch class by id', async () => {
      const created = await createClass('Math', teacherId);
      const klass = await getClassById(created.id);

      expect(klass).not.toBeNull();
      expect(klass?.name).toBe('Math');
    });

    it('should return null if class not found', async () => {
      const klass = await getClassById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(klass).toBeNull();
    });
  });

  describe('updateClass', () => {
    it('should update class name', async () => {
      const created = await createClass('Math', teacherId);
      const updated = await updateClass(created.id, 'Algebra');

      expect(updated?.name).toBe('Algebra');
    });

    it('should return null if class not found', async () => {
      const updated = await updateClass(
        '00000000-0000-0000-0000-000000000000',
        'New Name'
      );
      expect(updated).toBeNull();
    });
  });

  describe('deleteClass', () => {
    it('should delete class and cascade enrollments', async () => {
      const klass = await createClass('Math', teacherId);
      await enrollStudent(klass.id, studentId);

      await deleteClass(klass.id);

      const deleted = await getClassById(klass.id);
      expect(deleted).toBeNull();
    });
  });

  describe('enrollStudent', () => {
    it('should enroll student in class', async () => {
      const klass = await createClass('Math', teacherId);
      await enrollStudent(klass.id, studentId);

      const students = await getClassStudents(klass.id);

      expect(students).toHaveLength(1);
      expect(students[0]!.id).toBe(studentId);
    });

    it('should throw if class not found', async () => {
      await expect(
        enrollStudent('00000000-0000-0000-0000-000000000000', studentId)
      ).rejects.toThrow('Class not found');
    });

    it('should throw if student not found', async () => {
      const klass = await createClass('Math', teacherId);
      await expect(
        enrollStudent(klass.id, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Student not found');
    });

    it('should throw if already enrolled', async () => {
      const klass = await createClass('Math', teacherId);
      await enrollStudent(klass.id, studentId);

      await expect(
        enrollStudent(klass.id, studentId)
      ).rejects.toThrow('Student already enrolled');
    });
  });

  describe('removeStudent', () => {
    it('should remove student from class', async () => {
      const klass = await createClass('Math', teacherId);
      await enrollStudent(klass.id, studentId);
      await removeStudent(klass.id, studentId);

      const students = await getClassStudents(klass.id);

      expect(students).toHaveLength(0);
    });
  });

  describe('getClassStudents', () => {
    it('should fetch enrolled students', async () => {
      const klass = await createClass('Math', teacherId);

      const student2 = await db
        .insertInto('users')
        .values({
          email: 'student2@example.com',
          name: 'Student 2',
          role: 'student',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await enrollStudent(klass.id, studentId);
      await enrollStudent(klass.id, student2.id);

      const students = await getClassStudents(klass.id);

      expect(students).toHaveLength(2);
    });
  });
});
