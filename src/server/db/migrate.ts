import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { createServer, type ViteDevServer } from 'vite';
import { ViteNodeRunner } from 'vite-node/client';
import { ViteNodeServer } from 'vite-node/server';
import { Kysely, Migrator, PostgresDialect, type Migration, type MigrationProvider } from 'kysely';
import { Pool } from 'pg';
import { env } from '../env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFolder = path.join(__dirname, 'migrations');

class ViteNodeMigrationProvider implements MigrationProvider {
  private server?: ViteDevServer;

  async getMigrations(): Promise<Record<string, Migration>> {
    this.server = await createServer({
      optimizeDeps: { disabled: true },
      logLevel: 'silent',
    });
    await this.server.pluginContainer.buildStart({});

    const node = new ViteNodeServer(
      this.server as unknown as ConstructorParameters<typeof ViteNodeServer>[0]
    );
    const runner = new ViteNodeRunner({
      root: this.server.config.root,
      base: this.server.config.base,
      fetchModule: (id) => node.fetchModule(id),
      resolveId: (id, importer) => node.resolveId(id, importer),
    });

    const fileNames = (await fs.readdir(migrationFolder))
      .filter((fileName) => fileName.endsWith('.ts'))
      .sort();

    const migrations: Record<string, Migration> = {};

    for (const fileName of fileNames) {
      const migrationKey = fileName.replace(/\.ts$/, '');
      const module = await runner.executeFile(path.join(migrationFolder, fileName));
      migrations[migrationKey] = module;
    }

    return migrations;
  }

  async close(): Promise<void> {
    await this.server?.close();
  }
}

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

  const provider = new ViteNodeMigrationProvider();
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
