import { db } from '../db/client';
import type { TeacherGroup } from '../db/types';

// Fetch all teacher groups.
export async function listGroups(): Promise<TeacherGroup[]> {
  const groups = await db
    .selectFrom('teacher_groups')
    .selectAll()
    .orderBy('created_at', 'asc')
    .execute();

  return groups;
}

// Fetch teacher group by ID.
export async function getGroupById(id: string): Promise<TeacherGroup | null> {
  const group = await db
    .selectFrom('teacher_groups')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();

  return group || null;
}

// Create a new teacher group.
export async function createGroup(name: string): Promise<TeacherGroup> {
  const group = await db
    .insertInto('teacher_groups')
    .values({ name })
    .returningAll()
    .executeTakeFirstOrThrow();

  return group;
}

// Update teacher group name.
export async function updateGroup(
  id: string,
  name: string
): Promise<TeacherGroup | null> {
  const group = await db
    .updateTable('teacher_groups')
    .set({ name })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return group || null;
}

// Delete teacher group (cascade members).
export async function deleteGroup(id: string): Promise<void> {
  await db.deleteFrom('teacher_group_members').where('teacher_group_id', '=', id).execute();
  await db.deleteFrom('teacher_groups').where('id', '=', id).execute();
}

// Add teacher to group.
export async function addTeacherToGroup(
  groupId: string,
  teacherId: string
): Promise<void> {
  await db
    .insertInto('teacher_group_members')
    .values({ teacher_group_id: groupId, teacher_id: teacherId })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

// Remove teacher from group.
export async function removeTeacherFromGroup(
  groupId: string,
  teacherId: string
): Promise<void> {
  await db
    .deleteFrom('teacher_group_members')
    .where('teacher_group_id', '=', groupId)
    .where('teacher_id', '=', teacherId)
    .execute();
}
