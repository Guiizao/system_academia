/**
 * Confere que os modulos nativos carregam E funcionam dentro do Electron.
 * Roda antes de empacotar: sem isso, um instalador com binario da ABI errada
 * sairia daqui e so quebraria no notebook da academia.
 */
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const electron = join(aqui, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

const prova = `
  (async () => {
    const D = require('better-sqlite3');
    const db = new D(':memory:');
    db.exec('create table t(a)');
    db.prepare('insert into t values (?)').run(42);
    if (db.prepare('select a from t').get().a !== 42) throw new Error('better-sqlite3 nao gravou');

    const argon2 = require('argon2');
    const h = await argon2.hash('senha-de-prova', { type: argon2.argon2id });
    if (!await argon2.verify(h, 'senha-de-prova')) throw new Error('argon2 nao verificou a senha certa');
    if (await argon2.verify(h, 'outra')) throw new Error('argon2 aceitou senha errada');

    console.log('NATIVOS_OK');
  })().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
`;

const saida = execFileSync(electron, ['-e', prova], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8',
});
if (!saida.includes('NATIVOS_OK')) {
  console.error(saida);
  throw new Error('Módulos nativos não funcionam no Electron. Rode: npm run rebuild-nativos');
}
console.log('nativos verificados no Electron (better-sqlite3 + argon2)');
