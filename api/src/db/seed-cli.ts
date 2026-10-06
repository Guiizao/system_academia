import 'dotenv/config';
import { resolve } from 'node:path';
import { abrirBanco } from './client.js';
import { migrarComBackup } from './migrate.js';
import { semear, SENHA_DEMO } from './seed.js';

const caminho = resolve(process.env.DB_PATH ?? './dados/academia.db');
const forcar = process.argv.includes('--forcar');

const { db, sqlite } = abrirBanco(caminho);
migrarComBackup(db, sqlite, caminho);

const jaTem = sqlite.prepare("SELECT count(*) AS n FROM aluno").get() as { n: number };
if (jaTem.n > 0 && !forcar) {
  console.error(`\nO banco ${caminho} ja tem ${jaTem.n} alunos.`);
  console.error('O seed APAGA TUDO. Rode com --forcar se for mesmo isso.\n');
  process.exit(1);
}

const r = await semear(db);
sqlite.close();

console.log('\nDados de demonstracao gerados em', caminho);
console.table(r.contadores);
console.log('Usuarios (senha de todos: ' + SENHA_DEMO + '):');
console.table(r.equipe);
console.log('\n!! Dados de TESTE. Nao use estas senhas numa instalacao real exposta pelo tunel.\n');
