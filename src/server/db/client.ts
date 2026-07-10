import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { env } from '../env';
import type { Database } from './types';

const dialect = new PostgresDialect({
  pool: new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  }),
});

export const db = new Kysely<Database>({ dialect });
