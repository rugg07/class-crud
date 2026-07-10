import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Kysely, Migrator, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { env } from '../env';
import { ViteNodeMigrationProvider } from './migration-provider';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFolder = path.join(__dirname, 'migrations');

const direction = process.argv[2] === 'down' ? 'down' : 'up';

async function migrate() {
  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
      }),
    }),
  });

  const provider = new ViteNodeMigrationProvider(migrationFolder);
  const migrator = new Migrator({ db, provider });

  const { error, results } =
    direction === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(`✅ migration "${result.migrationName}" ${direction} succeeded`);
    } else if (result.status === 'Error') {
      console.error(`❌ migration "${result.migrationName}" ${direction} failed`);
    }
  });

  await provider.close();

  if (error) {
    console.error('Migration failed:', error);
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

migrate();
