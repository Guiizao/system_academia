import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco } from '../../src/db/client.js';
import { migrarComBackup } from '../../src/db/migrate.js';

let raiz: string | undefined;
afterEach(() => { if (raiz) rmSync(raiz, { recursive: true, force: true }); });

function boot(caminho: string) {
  const { db, sqlite } = abrirBanco(caminho);
  migrarComBackup(db, sqlite, caminho);
  sqlite.close();
}
const backups = (r: string) => existsSync(join(r, 'backups')) ? readdirSync(join(r, 'backups')) : [];

describe('migrarComBackup', () => {
  it('banco novo: migra e NAO faz backup (nao ha o que proteger)', () => {
    raiz = mkdtempSync(join(tmpdir(), 'df-mig-'));
    boot(join(raiz, 'dados', 'academia.db'));
    expect(backups(raiz)).toEqual([]);
  });

  it('REGRESSAO: reiniciar sem migracao pendente NAO gera backup a cada boot', () => {
    raiz = mkdtempSync(join(tmpdir(), 'df-mig-'));
    const caminho = join(raiz, 'dados', 'academia.db');
    boot(caminho);
    boot(caminho);
    boot(caminho);
    expect(backups(raiz)).toEqual([]);
  });

  it('com migracao NOVA pendente num banco em uso, faz o backup antes', () => {
    raiz = mkdtempSync(join(tmpdir(), 'df-mig-'));
    const caminho = join(raiz, 'dados', 'academia.db');
    boot(caminho); // banco em uso, tudo aplicado

    // simula uma atualizacao do sistema trazendo uma migration nova
    const pasta = join(raiz, 'drizzle');
    cpSync(join(process.cwd(), 'drizzle'), pasta, { recursive: true });
    const journalPath = join(pasta, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries.push({ ...journal.entries[0], idx: 1, tag: '0001_teste', when: Date.now() });
    writeFileSync(journalPath, JSON.stringify(journal));
    writeFileSync(join(pasta, '0001_teste.sql'), 'CREATE TABLE teste_atualizacao (id integer);');

    process.env.DF_MIGRATIONS = pasta;
    try { boot(caminho); } finally { delete process.env.DF_MIGRATIONS; }

    const feitos = backups(raiz);
    expect(feitos).toHaveLength(1);
    expect(feitos[0]).toMatch(/^pre-migracao-/);
  });
});
