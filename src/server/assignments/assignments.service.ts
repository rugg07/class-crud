import { db } from '../db/client';
import type { Assignment } from '../db/types';

// Fetch all assignments in a class.
export async function listAssignmentsByClass(
  classId: string
): Promise<Assignment[]> {
  const assignments = await db
    .selectFrom('assignments')
    .where('class_id', '=', classId)
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();

  return assignments;
}

// Fetch assignment by ID (include class_id for ownership check).
export async function getAssignmentById(
  id: string
): Promise<Assignment | null> {
  const assignment = await db
    .selectFrom('assignments')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();

  return assignment || null;
}

// Create assignment in draft state (published_at = null).
export async function createAssignment(
  classId: string,
  title: string,
  description: string | null,
  due_at: Date | null
): Promise<Assignment> {
  const assignment = await db
    .insertInto('assignments')
    .values({
      class_id: classId,
      title,
      description: description || null,
      due_at: due_at?.toISOString() || null,
      published_at: null,
      max_points: 100,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return assignment;
}

// Update assignment (title, description, due_at).
export async function updateAssignment(
  id: string,
  updates: { title?: string; description?: string; due_at?: Date | null }
): Promise<Assignment | null> {
  const normalizedUpdates: Record<string, any> = {};
  if (updates.title !== undefined) normalizedUpdates.title = updates.title;
  if (updates.description !== undefined) normalizedUpdates.description = updates.description;
  if (updates.due_at !== undefined) normalizedUpdates.due_at = updates.due_at?.toISOString() || null;

  const assignment = await db
    .updateTable('assignments')
    .set(normalizedUpdates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return assignment || null;
}

// Publish assignment (set published_at to now).
export async function publishAssignment(id: string): Promise<Assignment | null> {
  const assignment = await db
    .updateTable('assignments')
    .set({ published_at: new Date().toISOString() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return assignment || null;
}

// Delete assignment (cascade submissions per schema).
export async function deleteAssignment(id: string): Promise<void> {
  await db.deleteFrom('assignments').where('id', '=', id).execute();
}
