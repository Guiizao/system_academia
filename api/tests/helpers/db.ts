import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirBanco } from '../../src/db/client.js';

export function criarBancoDeTeste() {
  const { sqlite, db } = abrirBanco(':memory:');
  const dir = join(process.cwd(), 'drizzle');
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, arquivo), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const t = stmt.trim();
      if (t) sqlite.exec(t);
    }
  }
  return { db, sqlite, fechar: () => sqlite.close() };
}
