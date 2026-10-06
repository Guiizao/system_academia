import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import Database from 'better-sqlite3';
import { fazerBackup, selecionarRetencao, aplicarRetencao, listarBackups } from '../../src/servicos/backup.js';

let pasta: string | undefined;
afterEach(() => { if (pasta) rmSync(pasta, { recursive: true, force: true }); });

const nome = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `darkfisic-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.db`;
};

describe('fazerBackup', () => {
  it('gera copia consistente e legivel do banco em uso', () => {
    pasta = mkdtempSync(join(tmpdir(), 'df-bkp-'));
    const origem = join(pasta, 'origem.db');
    const db = new Database(origem);
    db.pragma('journal_mode = WAL');
    db.exec('create table aluno(nome text)');
    db.prepare('insert into aluno values (?)').run('Rafael');

    const destino = fazerBackup(db, join(pasta, 'backups'));
    db.close();

    const copia = new Database(destino, { readonly: true });
    expect(copia.prepare('select nome from aluno').get()).toEqual({ nome: 'Rafael' });
    expect(copia.pragma('integrity_check', { simple: true })).toBe('ok');
    copia.close();
  });
});

describe('retencao', () => {
  const agora = new Date(2026, 8, 21, 3, 0, 0);

  it('com backup diario por 400 dias, mantem no maximo 7+4+12', () => {
    const arquivos = Array.from({ length: 400 }, (_, i) => nome(new Date(2026, 8, 21 - i, 3, 0, 0)));
    const { manter, apagar } = selecionarRetencao(arquivos, agora);
    expect(manter.length).toBeLessThanOrEqual(23);
    expect(manter.length + apagar.length).toBe(400);
    expect(manter).toContain(arquivos[0]); // o mais recente nunca e apagado
  });

  it('mantem os 7 dias mais recentes todos', () => {
    const arquivos = Array.from({ length: 10 }, (_, i) => nome(new Date(2026, 8, 21 - i, 3, 0, 0)));
    const { manter } = selecionarRetencao(arquivos, agora);
    for (let i = 0; i < 7; i++) expect(manter).toContain(arquivos[i]);
  });

  it('dois backups no mesmo dia: fica so o mais recente daquele dia', () => {
    const cedo = nome(new Date(2026, 8, 20, 3, 0, 0));
    const tarde = nome(new Date(2026, 8, 20, 15, 0, 0));
    const { manter, apagar } = selecionarRetencao([cedo, tarde], agora);
    expect(manter).toEqual([tarde]);
    expect(apagar).toEqual([cedo]);
  });

  it('nunca apaga arquivo que nao e backup', () => {
    pasta = mkdtempSync(join(tmpdir(), 'df-ret-'));
    writeFileSync(join(pasta, 'importante.txt'), 'x');
    for (let i = 0; i < 30; i++) writeFileSync(join(pasta, nome(new Date(2026, 8, 21 - i, 3))), '');
    aplicarRetencao(pasta, agora);
    expect(readdirSync(pasta)).toContain('importante.txt');
  });
});

describe('copia antes de comecar do zero', () => {
  it('tem nome proprio, aparece na lista e a retencao nunca apaga', () => {
    pasta = mkdtempSync(join(tmpdir(), 'df-reset-'));
    const db = new Database(join(pasta, 'origem.db'));
    db.exec('create table aluno(nome text)');
    const copia = fazerBackup(db, pasta, new Date(2026, 8, 21, 10), 'antes-do-reset');
    db.close();
    // backups normais no mesmo dia e depois: a retencao roda varias vezes
    for (let h = 11; h < 15; h++) writeFileSync(join(pasta, nome(new Date(2026, 8, 21, h))), '');
    for (let i = 1; i < 40; i++) writeFileSync(join(pasta, nome(new Date(2026, 8, 21 + i, 3))), '');
    aplicarRetencao(pasta, new Date(2026, 9, 30));
    const arquivo = basename(copia);
    expect(arquivo).toMatch(/^antes-do-reset-2026-09-21_10-00-00\.db$/);
    expect(readdirSync(pasta)).toContain(arquivo);
    expect(listarBackups(pasta).map((b) => b.nome)).toContain(arquivo);
  });

  it('copias antes da importacao e da atualizacao tambem aparecem e nunca saem pela retencao', () => {
    pasta = mkdtempSync(join(tmpdir(), 'df-bkp-'));
    const especiais = ['antes-da-importacao-2026-10-02_10-00-00.db', 'antes-da-atualizacao-2026-10-02_09-00-00.db'];
    especiais.forEach((n) => writeFileSync(join(pasta!, n), ''));
    for (let i = 1; i < 40; i++) writeFileSync(join(pasta, nome(new Date(2026, 9, 2 + i, 3))), '');
    aplicarRetencao(pasta, new Date(2026, 10, 30));
    expect(readdirSync(pasta)).toEqual(expect.arrayContaining(especiais));
    expect(listarBackups(pasta).map((b) => b.nome)).toEqual(expect.arrayContaining(especiais));
  });
});
