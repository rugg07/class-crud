import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('teacher_groups')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable('teacher_group_members')
    .addColumn('teacher_group_id', 'uuid', (col) =>
      col.notNull().references('teacher_groups.id').onDelete('cascade')
    )
    .addColumn('teacher_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addPrimaryKeyConstraint('teacher_group_members_pk', [
      'teacher_group_id',
      'teacher_id',
    ])
    .execute();

  await db.schema
    .createIndex('teacher_group_members_teacher_id_idx')
    .on('teacher_group_members')
    .column('teacher_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('teacher_group_members').execute();
  await db.schema.dropTable('teacher_groups').execute();
}
