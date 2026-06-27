import { createRequire } from 'node:module';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const require = createRequire(import.meta.url);

export type BetterSqliteConstructor = new (filename: string) => BetterSqliteDatabase;

export function loadBetterSqlite(): BetterSqliteConstructor {
  return require('better-sqlite3') as BetterSqliteConstructor;
}
