/**
 * Testa o app EMPACOTADO como ele vai rodar na academia: copiado para fora
 * da pasta do projeto, ligado de verdade, com o servidor respondendo.
 *
 * Por que fora do projeto: o Node procura bibliotecas subindo pelas pastas.
 * Rodando de dentro de desktop/instalador, ele achava o desktop/node_modules
 * do desenvolvimento e mascarava um pacote quebrado -- foi assim que a
 * versao 0.1.0 passou nos testes e falhou no PC da academia ("Cannot find
 * package 'dotenv'").
 *
 * Uso: node scripts/testar-pacote.mjs   (o "npm run build" ja chama no fim)
 */
import { cpSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, dirname, parse } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(desktop, 'instalador', 'win-unpacked');
const PORTA = Number(process.env.DF_PORTA_TESTE ?? 3099);
const LIMITE_MS = 45_000;

const falhar = (msg) => { console.error(`\nFALHOU: ${msg}`); process.exitCode = 1; };

/** O teste so vale se nenhuma pasta acima da copia tiver node_modules. */
function nodeModulesAcima(pasta) {
  for (let p = pasta; p !== parse(p).root; p = dirname(p)) {
    if (existsSync(join(p, 'node_modules'))) return p;
  }
  return null;
}

async function esperarServidor(fim) {
  while (Date.now() < fim) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/status`);
      if (r.ok) return await r.json();
    } catch { /* ainda subindo */ }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  return null;
}

function encerrar(pid) {
  // Electron abre processos filhos (GPU, renderer): mata a arvore inteira
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ja saiu */ }
}

async function apagar(pasta) {
  // logo depois do taskkill o Windows ainda segura alguns arquivos por instantes
  for (let i = 0; i < 10; i++) {
    try { rmSync(pasta, { recursive: true, force: true }); return; } catch { await new Promise((ok) => setTimeout(ok, 1000)); }
  }
  console.warn(`Aviso: não consegui apagar ${pasta} (arquivo preso). Pode apagar à mão.`);
}

if (!existsSync(join(origem, 'DARK FISIC.exe'))) {
  falhar(`não achei ${origem}. Rode o electron-builder antes.`);
  process.exit();
}

const base = join(tmpdir(), `df-teste-pacote-${Date.now()}`);
const acima = nodeModulesAcima(base);
if (acima) {
  falhar(`existe node_modules em ${acima}. O teste ficaria viciado (acharia bibliotecas que o pacote não tem). Aponte a variável TEMP para outra pasta.`);
  process.exit();
}

const copia = join(base, 'app');
const dados = join(base, 'dados');
console.log(`Copiando o pacote para fora do projeto: ${copia}`);
cpSync(origem, copia, { recursive: true });
mkdirSync(dados, { recursive: true });

const proc = spawn(join(copia, 'DARK FISIC.exe'), ['--oculto'], {
  env: { ...process.env, DF_PORTA: String(PORTA), DF_DADOS: dados },
  stdio: 'ignore',
});

try {
  const status = await esperarServidor(Date.now() + LIMITE_MS);
  const caminhoLog = join(dados, 'logs', 'darkfisic.log');
  const log = existsSync(caminhoLog) ? readFileSync(caminhoLog, 'utf8') : '(sem log)';
  const erros = log.split('\n').filter((l) => l.includes(' ERRO '));

  if (!status) {
    falhar(`o servidor não respondeu em ${LIMITE_MS / 1000}s na porta ${PORTA}.\nLog do app:\n${log}`);
  } else if (status.banco !== 'conectado') {
    falhar(`servidor no ar, mas o banco não conectou: ${JSON.stringify(status)}`);
  } else if (erros.length) {
    falhar(`o log tem erros:\n${erros.join('\n')}`);
  } else {
    const pagina = await (await fetch(`http://localhost:${PORTA}/`)).text();
    if (!pagina.includes('DARK FISIC')) falhar('o servidor subiu, mas não entregou a interface (web).');
    else console.log(`\nOK: pacote ${status.versao} sobe fora do projeto, banco conectado e interface no ar.`);
  }
} finally {
  encerrar(proc.pid);
  await apagar(base);
}
