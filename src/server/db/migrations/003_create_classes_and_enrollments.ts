import { Kysely, sql } from 'kysely';
import type { Database } from '../types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('classes')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('teacher_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict')
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex('classes_teacher_id_idx')
    .on('classes')
    .column('teacher_id')
    .execute();

  await db.schema
    .createTable('enrollments')
    .addColumn('class_id', 'uuid', (col) =>
      col.notNull().references('classes.id').onDelete('cascade')
    )
    .addColumn('student_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('enrolled_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('enrollments_pk', ['class_id', 'student_id'])
    .execute();

  await db.schema
    .createIndex('enrollments_student_id_idx')
    .on('enrollments')
    .column('student_id')
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('enrollments').execute();
  await db.schema.dropTable('classes').execute();
}
