import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { createServer, type ViteDevServer } from 'vite';
import { ViteNodeRunner } from 'vite-node/client';
import { ViteNodeServer } from 'vite-node/server';
import type { Migration, MigrationProvider } from 'kysely';

export class ViteNodeMigrationProvider implements MigrationProvider {
  private server?: ViteDevServer;

  constructor(private readonly migrationFolder: string) {}

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

    const fileNames = (await fs.readdir(this.migrationFolder))
      .filter((fileName) => fileName.endsWith('.ts'))
      .sort();

    const migrations: Record<string, Migration> = {};

    for (const fileName of fileNames) {
      const migrationKey = fileName.replace(/\.ts$/, '');
      const module = await runner.executeFile(path.join(this.migrationFolder, fileName));
      migrations[migrationKey] = module;
    }

    return migrations;
  }

  async close(): Promise<void> {
    await this.server?.close();
  }
}
