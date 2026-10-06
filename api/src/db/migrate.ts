import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import type Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

const aqui = dirname(fileURLToPath(import.meta.url));

/** Pasta das migrations: ao lado do codigo em dev, empacotada em producao. */
export function pastaMigrations(): string {
  const candidatas = [
    process.env.DF_MIGRATIONS,
    join(aqui, '..', '..', 'drizzle'),
    join(aqui, '..', 'drizzle'),
    join(process.cwd(), 'drizzle'),
  ].filter(Boolean) as string[];
  const achada = candidatas.find((p) => existsSync(join(p, 'meta', '_journal.json')));
  if (!achada) throw new Error('Pasta de migrations não encontrada');
  return achada;
}

/**
 * Quantas migrations do journal ainda nao foram aplicadas neste banco.
 * null = banco novo (a tabela de controle do Drizzle ainda nem existe).
 */
function pendentes(sqlite: Database.Database, pasta: string): number | null {
  const total = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8')).entries.length;
  const existe = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get();
  if (!existe) return null;
  const aplicadas = (sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number }).n;
  return Math.max(0, total - aplicadas);
}

/**
 * Backup antes de migrar (spec 9.5) -- mas SO quando ha migracao pendente
 * num banco que ja estava em uso. Banco novo nao tem o que proteger, e
 * reiniciar sem migracao nova nao mudou nada: copiar a cada boot encheria
 * a pasta de backups sem limite (esses arquivos nao passam pela retencao).
 */
export function migrarComBackup(db: BetterSQLite3Database<any>, sqlite: Database.Database, caminhoBanco: string) {
  const pasta = pastaMigrations();
  const n = pendentes(sqlite, pasta);
  if (n && caminhoBanco !== ':memory:' && existsSync(caminhoBanco)) {
    const destino = join(dirname(caminhoBanco), '..', 'backups');
    mkdirSync(destino, { recursive: true });
    const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
    // VACUUM INTO: copia consistente mesmo com o banco aberto (WAL)
    sqlite.prepare('VACUUM INTO ?').run(join(destino, `pre-migracao-${carimbo}.db`));
  }
  migrate(db, { migrationsFolder: pasta });
}
