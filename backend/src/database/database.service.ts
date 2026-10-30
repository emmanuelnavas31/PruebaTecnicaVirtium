import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';
import { seed } from './seed.js';

export type Db = BetterSQLite3Database<typeof schema>;
/** La base o una transacción en curso: ambas exponen la misma API de consultas. */
export type DbExecutor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

// src/database y dist/database están a la misma profundidad respecto a backend/drizzle.
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly sqlite: Database.Database;
  readonly db: Db;

  constructor(config: ConfigService<Env, true>) {
    const path = config.get('DB_PATH', { infer: true });
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

    this.sqlite = new Database(path);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('busy_timeout = 5000');

    this.db = drizzle(this.sqlite, { schema });
    migrate(this.db, { migrationsFolder: MIGRATIONS_FOLDER });
    seed(this.db);
    this.logger.log(`SQLite listo en ${path}`);
  }

  /**
   * Transacción síncrona con BEGIN IMMEDIATE: toma el lock de escritura al inicio,
   * así dos operaciones sobre el mismo saldo nunca se intercalan.
   */
  transaction<T>(fn: (tx: DbExecutor) => T): T {
    return this.db.transaction(fn, { behavior: 'immediate' });
  }

  onApplicationShutdown(): void {
    this.sqlite.close();
  }
}
