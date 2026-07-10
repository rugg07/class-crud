import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../../db/client';
import {
  listAssignmentsByClass,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  publishAssignment,
  deleteAssignment,
} from '../../../assignments/assignments.service';

describe('Assignments Service', () => {
  let classId: string;
  let teacherId: string;

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

    const klass = await db
      .insertInto('classes')
      .values({ name: 'Math', teacher_id: teacherId })
      .returningAll()
      .executeTakeFirstOrThrow();
    classId = klass.id;
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

  describe('createAssignment', () => {
    it('should create assignment in draft state', async () => {
      const due = new Date();
      const assignment = await createAssignment(
        classId,
        'Homework 1',
        'Chapter 1-3',
        due
      );

      expect(assignment.title).toBe('Homework 1');
      expect(assignment.description).toBe('Chapter 1-3');
      expect(assignment.published_at).toBeNull();
    });

    it('should create assignment without description', async () => {
      const assignment = await createAssignment(classId, 'Quiz', null, null);

      expect(assignment.title).toBe('Quiz');
      expect(assignment.description).toBeNull();
    });
  });

  describe('listAssignmentsByClass', () => {
    it('should list all assignments in class', async () => {
      await createAssignment(classId, 'Homework 1', null, null);
      await createAssignment(classId, 'Homework 2', null, null);

      const assignments = await listAssignmentsByClass(classId);

      expect(assignments).toHaveLength(2);
    });

    it('should return empty list if no assignments', async () => {
      const assignments = await listAssignmentsByClass(classId);
      expect(assignments).toHaveLength(0);
    });
  });

  describe('getAssignmentById', () => {
    it('should fetch assignment by id', async () => {
      const created = await createAssignment(
        classId,
        'Homework 1',
        null,
        null
      );
      const assignment = await getAssignmentById(created.id);

      expect(assignment).not.toBeNull();
      expect(assignment?.title).toBe('Homework 1');
    });

    it('should return null if not found', async () => {
      const assignment = await getAssignmentById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(assignment).toBeNull();
    });
  });

  describe('updateAssignment', () => {
    it('should update assignment title', async () => {
      const created = await createAssignment(
        classId,
        'Homework 1',
        null,
        null
      );
      const updated = await updateAssignment(created.id, {
        title: 'Updated Title',
      });

      expect(updated?.title).toBe('Updated Title');
    });

    it('should update description', async () => {
      const created = await createAssignment(
        classId,
        'Homework 1',
        'Old description',
        null
      );
      const updated = await updateAssignment(created.id, {
        description: 'New description',
      });

      expect(updated?.description).toBe('New description');
    });

    it('should return null if not found', async () => {
      const updated = await updateAssignment('00000000-0000-0000-0000-000000000000', {
        title: 'New Title',
      });
      expect(updated).toBeNull();
    });
  });

  describe('publishAssignment', () => {
    it('should set published_at to now', async () => {
      const created = await createAssignment(
        classId,
        'Homework 1',
        null,
        null
      );
      const before = new Date();
      const published = await publishAssignment(created.id);
      const after = new Date();

      expect(published?.published_at).not.toBeNull();
      expect(published && published.published_at && published.published_at >= before).toBe(true);
      expect(published && published.published_at && published.published_at <= after).toBe(true);
    });

    it('should return null if not found', async () => {
      const published = await publishAssignment('00000000-0000-0000-0000-000000000000');
      expect(published).toBeNull();
    });
  });

  describe('deleteAssignment', () => {
    it('should delete assignment', async () => {
      const created = await createAssignment(
        classId,
        'Homework 1',
        null,
        null
      );
      await deleteAssignment(created.id);

      const deleted = await getAssignmentById(created.id);
      expect(deleted).toBeNull();
    });
  });
});
