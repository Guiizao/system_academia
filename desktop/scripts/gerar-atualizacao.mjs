/**
 * Monta o zip de atualizacao: o mesmo conteudo que vai para
 * "resources\app" na instalacao, SEM o node_modules (que nao muda) --
 * por isso cabe no chat, enquanto o instalador tem 121 MB.
 *
 * Uso: node scripts/gerar-atualizacao.mjs [--alunos caminho\alunos.json]
 * (o "npm run build" chama no fim; o conteudo vem de desktop/, ja preparado
 * pelo preparar.mjs, entao nao depende do electron-builder ter rodado)
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMITE_MB = 30;
// o mesmo que build.files do package.json, menos o node_modules
const DO_PACOTE = ['main.js', 'preload.cjs', 'preload-sistema.cjs', 'package.json', 'painel', 'sistema', 'app'];

const pkg = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'));
const alunos = (() => {
  const i = process.argv.indexOf('--alunos');
  return i > 0 ? process.argv[i + 1] : null;
})();

const saida = join(desktop, 'instalador', 'atualizacao');
const nome = `DARK-FISIC-Atualizacao-${pkg.version}`;
const base = join(saida, nome);
const pacote = join(base, 'pacote');
rmSync(base, { recursive: true, force: true });
mkdirSync(pacote, { recursive: true });

for (const item of DO_PACOTE) {
  const de = join(desktop, item);
  if (!existsSync(de)) throw new Error(`faltou ${item} em desktop/ (rode "npm run preparar" antes)`);
  cpSync(de, join(pacote, item), { recursive: true });
}
for (const obrigatorio of ['app/servidor/index.js', 'app/web/index.html', 'app/drizzle/meta/_journal.json', 'main.js']) {
  if (!existsSync(join(pacote, obrigatorio))) throw new Error(`o pacote ficou sem ${obrigatorio}`);
}

/** Impressao digital de cada arquivo: o atualizador recusa pacote corrompido. */
function listar(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    return e.isDirectory() ? listar(caminho) : [caminho];
  });
}
const arquivos = listar(pacote).map((caminho) => ({
  caminho: relative(pacote, caminho).replaceAll('\\', '/'),
  sha256: createHash('sha256').update(readFileSync(caminho)).digest('hex').toUpperCase(),
}));

writeFileSync(join(pacote, 'atualizacao.json'), JSON.stringify({
  versao: pkg.version,
  geradoEm: new Date().toISOString(),
  dependencias: pkg.dependencies,
  arquivos,
}, null, 2));

// o PowerShell do Windows le .ps1 com acento corretamente so com BOM
const ps1 = readFileSync(join(desktop, 'atualizador', 'atualizar.ps1'), 'utf8').replace(/^﻿/, '');
writeFileSync(join(base, 'atualizar.ps1'), '﻿' + ps1, 'utf8');
for (const f of ['ATUALIZAR.bat', 'LEIA-ME.txt']) cpSync(join(desktop, 'atualizador', f), join(base, f));

if (alunos) {
  mkdirSync(join(base, 'alunos'), { recursive: true });
  cpSync(alunos, join(base, 'alunos', 'alunos-planilha.json'));
}

// tar.exe do proprio Windows: sem biblioteca de terceiros so para zipar.
// Roda DENTRO da pasta com nomes relativos: com "C:\..." no -f, o bsdtar
// entende o "C:" como maquina remota ("Cannot connect to C").
const zip = join(saida, `${nome}.zip`);
rmSync(zip, { force: true });
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-a', '-c', '-f', `${nome}.zip`, nome], { cwd: saida, stdio: 'inherit' });

const mb = statSync(zip).size / 1024 / 1024;
if (mb > LIMITE_MB) throw new Error(`o zip ficou com ${mb.toFixed(1)} MB (limite ${LIMITE_MB} MB)`);
// identificacao que o dono compara com a que o atualizador mostra na tela
const identificacao = createHash('sha256').update(readFileSync(join(pacote, 'atualizacao.json'))).digest('hex').toUpperCase().slice(0, 16);
console.log(`\n${zip}\n${arquivos.length} arquivos, ${mb.toFixed(2)} MB${alunos ? ', com o arquivo de alunos' : ''}`);
console.log(`Identificacao do pacote: ${identificacao}`);
