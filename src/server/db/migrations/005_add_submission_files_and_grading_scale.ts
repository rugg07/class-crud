import { Kysely, sql } from 'kysely';
import type { Database } from '../types';

export async function up(db: Kysely<Database>): Promise<void> {
  // Add file metadata columns to support doc/pdf/image uploads in submissions
  await db.schema
    .alterTable('submission_versions')
    .addColumn('file_url', 'text')
    .addColumn('file_name', 'text')
    .addColumn('mime_type', 'text')
    .addColumn('file_size', 'integer')
    .execute();

  // Add max_points to assignments so grades have a defined scale
  await db.schema
    .alterTable('assignments')
    .addColumn('max_points', sql`numeric(5,2)`, (col) =>
      col.notNull().defaultTo('100')
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('assignments')
    .dropColumn('max_points')
    .execute();

  await db.schema
    .alterTable('submission_versions')
    .dropColumn('file_url')
    .dropColumn('file_name')
    .dropColumn('mime_type')
    .dropColumn('file_size')
    .execute();
}
