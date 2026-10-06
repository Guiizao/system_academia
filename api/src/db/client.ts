import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.js';

export function abrirBanco(caminho: string) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const sqlite = new Database(caminho);

  // WAL melhora leitura concorrente.
  // foreign_keys NAO vem ligado por padrao no SQLite -- sem este pragma
  // todas as FKs do schema seriam decorativas.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  return { sqlite, db: drizzle(sqlite, { schema }) };
}
