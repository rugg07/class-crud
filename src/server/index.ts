import { env } from './env';
import { db } from './db/client';
import { buildApp } from './app';
import { Migrator } from 'kysely';
import path from 'path';
import { fileURLToPath } from 'url';
import { ViteNodeMigrationProvider } from './db/migration-provider';

export { db };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run migrations and start server.
async function main() {
  console.log(`Starting server in ${env.NODE_ENV} mode`);
  console.log(`Database: ${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  console.log(`Redis: ${env.REDIS_URL}`);

  // Run pending migrations.
  const provider = new ViteNodeMigrationProvider(path.join(__dirname, 'db/migrations'));
  const migrator = new Migrator({ db, provider });

  const { error, results } = await migrator.migrateToLatest();
  await provider.close();
  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  if (results && results.length > 0) {
    console.log('Migrations run:', results.map((r) => r.migrationName));
  }

  // Build and start Fastify app.
  const fastify = await buildApp();
  await fastify.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Server listening on http://0.0.0.0:3001');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
