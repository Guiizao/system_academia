/**
 * Mede o painel do servidor na janela de verdade do Electron, em varios
 * tamanhos de tela. O 1366x768 do notebook da academia e a medida que importa:
 * ali o painel tem que caber INTEIRO, sem rolagem de pagina.
 *
 * Roda com a janela escondida (--oculto) e com dados e porta isolados, entao
 * nao aparece nada na tela nem encosta no banco de verdade.
 *
 * Uso: node scripts/conferir-painel.mjs [--captura arquivo.png]
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA_APP = 3097;
const PORTA_CDP = 9333;
// altura util = tela menos a barra de tarefas e a barra de titulo do app
const TAMANHOS = [
  { nome: '1366x768 (notebook da academia)', largura: 1366, altura: 734 },
  { nome: '1280x720', largura: 1280, altura: 686 },
  { nome: '1024x768', largura: 1024, altura: 734 },
  { nome: '900x600 (janela pequena)', largura: 900, altura: 600 },
];

const captura = process.argv.includes('--captura') ? process.argv[process.argv.indexOf('--captura') + 1] : null;
const dados = mkdtempSync(join(tmpdir(), 'df-painel-'));
let falhas = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const falhou = (m) => { console.error(`  FALHOU  ${m}`); falhas++; };

const electron = spawn(join(desktop, 'node_modules', '.bin', 'electron.cmd'), ['.', '--oculto', `--remote-debugging-port=${PORTA_CDP}`], {
  cwd: desktop, env: { ...process.env, DF_DADOS: dados, DF_PORTA: String(PORTA_APP) },
  stdio: 'ignore', windowsHide: true, shell: true,
});

async function painelCdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const paginas = await (await fetch(`http://localhost:${PORTA_CDP}/json`)).json();
      const p = paginas.find((x) => x.type === 'page' && x.url.includes('painel'));
      if (p) return p;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function encerrar() {
  try { execFileSync('taskkill', ['/PID', String(electron.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ja saiu */ }
  // o Windows ainda segura o banco por instantes depois de matar o processo
  for (let i = 0; i < 8; i++) {
    try { rmSync(dados, { recursive: true, force: true }); return; }
    catch { await new Promise((r) => setTimeout(r, 700)); }
  }
}

const pagina = await painelCdp();
if (!pagina) { await encerrar(); console.error('nao consegui abrir o painel'); process.exit(1); }

const ws = new WebSocket(pagina.webSocketDebuggerUrl);
let id = 0; const pendentes = new Map();
ws.onmessage = (m) => { const r = JSON.parse(m.data); pendentes.get(r.id)?.(r); };
const enviar = (method, params = {}) => new Promise((res) => { pendentes.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
await new Promise((res) => { ws.onopen = res; });

// o painel tem dois estados: instalacao nova (com o cartao da conta) e o do
// dia a dia, ja configurado. O que precisa caber na tela e o do dia a dia.
const medir = (primeiroAcesso) => `(() => {
  const conta = document.querySelector('#cartao-config');
  if (conta) conta.hidden = ${!primeiroAcesso ? 'true' : 'false'};
  const d = document.documentElement;
  const estouros = [...document.querySelectorAll('body *')]
    .filter((el) => { const b = el.getBoundingClientRect(); return b.width && b.right > innerWidth + 1; })
    .map((el) => (el.tagName + '.' + el.className).slice(0, 40));
  const logs = document.querySelector('#logs');
  return {
    rolaPagina: d.scrollHeight > innerHeight + 1,
    sobra: innerHeight - d.scrollHeight,
    registroRola: logs ? getComputedStyle(logs).overflowY : null,
    alturaRegistro: logs ? Math.round(logs.getBoundingClientRect().height) : 0,
    estouros: [...new Set(estouros)].slice(0, 5),
  };
})()`;

console.log('\nPainel do servidor\n');
for (const t of TAMANHOS) {
  await enviar('Emulation.setDeviceMetricsOverride', { width: t.largura, height: t.altura, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 350));
  const r = await enviar('Runtime.evaluate', { expression: medir(false), returnByValue: true });
  const m = r.result?.result?.value ?? {};
  const rNovo = await enviar('Runtime.evaluate', { expression: medir(true), returnByValue: true });
  const novo = rNovo.result?.result?.value ?? {};
  console.log(`${t.nome}`);
  // abaixo de 1100x620 o painel volta a rolar de proposito (janela pequena)
  const precisaCaber = t.largura >= 1100 && t.altura >= 620;
  if (precisaCaber) {
    if (m.rolaPagina) falhou(`a pagina rola (faltam ${-m.sobra}px)`); else ok(`cabe na tela (sobram ${m.sobra}px)`);
    if (m.registroRola === 'auto' || m.registroRola === 'scroll') ok(`o Registro rola sozinho (${m.alturaRegistro}px de altura)`);
    else falhou(`o Registro deveria rolar sozinho (overflow-y: ${m.registroRola})`);
  } else {
    ok('janela pequena: pode rolar a pagina');
  }
  if (m.estouros?.length) falhou(`passa da largura: ${m.estouros.join(', ')}`); else ok('nada passa da largura');
  // instalacao nova: pode rolar (o cartao da conta e grande), mas nao pode cortar
  if (novo.estouros?.length) falhou(`instalacao nova passa da largura: ${novo.estouros.join(', ')}`);
  else ok('instalacao nova (cartao da conta) tambem cabe na largura');
}

if (captura) {
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 734, deviceScaleFactor: 1, mobile: false });
  // captura o painel do dia a dia (sem o cartao de primeiro acesso)
  await enviar('Runtime.evaluate', { expression: medir(false), returnByValue: true });
  await new Promise((r) => setTimeout(r, 400));
  const r = await enviar('Page.captureScreenshot', { format: 'png' });
  writeFileSync(captura, Buffer.from(r.result.data, 'base64'));
  console.log(`\ncaptura em ${captura}`);
}

ws.close();
await encerrar();
console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} problema(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
