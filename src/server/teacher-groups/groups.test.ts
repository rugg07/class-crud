import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/client';
import {
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addTeacherToGroup,
  removeTeacherFromGroup,
} from './groups.service';

describe('Teacher Groups Service', () => {
  let teacher1Id: string;
  let teacher2Id: string;

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

    const t1 = await db
      .insertInto('users')
      .values({
        email: 'teacher1@example.com',
        name: 'Teacher 1',
        role: 'teacher',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    teacher1Id = t1.id;

    const t2 = await db
      .insertInto('users')
      .values({
        email: 'teacher2@example.com',
        name: 'Teacher 2',
        role: 'teacher',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    teacher2Id = t2.id;
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

  describe('createGroup', () => {
    it('should create a new group', async () => {
      const group = await createGroup('Math Teachers');

      expect(group.name).toBe('Math Teachers');
      expect(group.id).toBeTruthy();
    });
  });

  describe('listGroups', () => {
    it('should list all groups', async () => {
      await createGroup('Math');
      await createGroup('Science');
      await createGroup('English');

      const groups = await listGroups();

      expect(groups).toHaveLength(3);
      expect(groups.map((g) => g.name)).toContain('Math');
    });

    it('should return empty list when no groups', async () => {
      const groups = await listGroups();
      expect(groups).toHaveLength(0);
    });
  });

  describe('getGroupById', () => {
    it('should fetch group by id', async () => {
      const created = await createGroup('Math Teachers');
      const group = await getGroupById(created.id);

      expect(group).not.toBeNull();
      expect(group?.name).toBe('Math Teachers');
    });

    it('should return null if group not found', async () => {
      const group = await getGroupById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(group).toBeNull();
    });
  });

  describe('updateGroup', () => {
    it('should update group name', async () => {
      const group = await createGroup('Math');
      const updated = await updateGroup(group.id, 'Algebra');

      expect(updated?.name).toBe('Algebra');
    });

    it('should return null if group not found', async () => {
      const updated = await updateGroup(
        '00000000-0000-0000-0000-000000000000',
        'New Name'
      );
      expect(updated).toBeNull();
    });
  });

  describe('deleteGroup', () => {
    it('should delete group and cascade members', async () => {
      const group = await createGroup('Math');
      await addTeacherToGroup(group.id, teacher1Id);
      await addTeacherToGroup(group.id, teacher2Id);

      await deleteGroup(group.id);

      const deleted = await getGroupById(group.id);
      expect(deleted).toBeNull();
    });
  });

  describe('addTeacherToGroup', () => {
    it('should add teacher to group', async () => {
      const group = await createGroup('Math');
      await addTeacherToGroup(group.id, teacher1Id);

      const members = await db
        .selectFrom('teacher_group_members')
        .where('teacher_group_id', '=', group.id)
        .selectAll()
        .execute();

      expect(members).toHaveLength(1);
      expect(members[0]!.teacher_id).toBe(teacher1Id);
    });

    it('should not duplicate membership', async () => {
      const group = await createGroup('Math');
      await addTeacherToGroup(group.id, teacher1Id);
      await addTeacherToGroup(group.id, teacher1Id);

      const members = await db
        .selectFrom('teacher_group_members')
        .where('teacher_group_id', '=', group.id)
        .selectAll()
        .execute();

      expect(members).toHaveLength(1);
    });
  });

  describe('removeTeacherFromGroup', () => {
    it('should remove teacher from group', async () => {
      const group = await createGroup('Math');
      await addTeacherToGroup(group.id, teacher1Id);
      await removeTeacherFromGroup(group.id, teacher1Id);

      const members = await db
        .selectFrom('teacher_group_members')
        .where('teacher_group_id', '=', group.id)
        .selectAll()
        .execute();

      expect(members).toHaveLength(0);
    });
  });
});
