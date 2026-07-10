import { Kysely, sql } from 'kysely';
import type { Database } from '../types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema.createType('user_role').asEnum(['admin', 'teacher', 'student']).execute();

  await db.schema.createType('user_status').asEnum(['active', 'suspended']).execute();

  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text')
    .addColumn('oauth_provider', 'text')
    .addColumn('oauth_id', 'text')
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('role', sql`user_role`, (col) => col.notNull())
    .addColumn('status', sql`user_status`, (col) => col.notNull().defaultTo('active'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('users_oauth_provider_oauth_id_index')
    .on('users')
    .columns(['oauth_provider', 'oauth_id'])
    .unique()
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('users').execute();

  await db.schema.dropType('user_status').execute();
  await db.schema.dropType('user_role').execute();
}
