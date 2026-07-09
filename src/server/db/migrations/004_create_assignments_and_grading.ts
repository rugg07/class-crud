import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('assignments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('class_id', 'uuid', (col) =>
      col.notNull().references('classes.id').onDelete('cascade')
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('due_at', 'timestamptz')
    .addColumn('published_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex('assignments_class_id_idx')
    .on('assignments')
    .column('class_id')
    .execute();

  await db.schema
    .createTable('submissions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('assignment_id', 'uuid', (col) =>
      col.notNull().references('assignments.id').onDelete('cascade')
    )
    .addColumn('student_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint('submissions_assignment_student_unique', [
      'assignment_id',
      'student_id',
    ])
    .execute();

  await db.schema
    .createIndex('submissions_student_id_idx')
    .on('submissions')
    .column('student_id')
    .execute();

  await db.schema
    .createTable('submission_versions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('submission_id', 'uuid', (col) =>
      col.notNull().references('submissions.id').onDelete('cascade')
    )
    .addColumn('version_number', 'integer', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('submitted_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint('submission_versions_submission_version_unique', [
      'submission_id',
      'version_number',
    ])
    .execute();

  await db.schema
    .createIndex('submission_versions_submission_id_idx')
    .on('submission_versions')
    .column('submission_id')
    .execute();

  await db.schema
    .createTable('grades')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('submission_id', 'uuid', (col) =>
      col.notNull().references('submissions.id').onDelete('cascade')
    )
    .addColumn('graded_version_id', 'uuid', (col) =>
      col.notNull().references('submission_versions.id').onDelete('restrict')
    )
    .addColumn('grade', sql`numeric(5,2)`, (col) => col.notNull())
    .addColumn('feedback', 'text')
    .addColumn('graded_by', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict')
    )
    .addColumn('graded_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex('grades_submission_id_idx')
    .on('grades')
    .column('submission_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('grades').execute();
  await db.schema.dropTable('submission_versions').execute();
  await db.schema.dropTable('submissions').execute();
  await db.schema.dropTable('assignments').execute();
}
