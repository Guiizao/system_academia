#!/usr/bin/env node
/*
 * Auditoria de telas nos 6 tamanhos de referência (2 pequenos, 2 médios, 2 grandes) + 2 deitados.
 * Sem dependências: usa o Chrome ou o Edge já instalado (ou CHROME_PATH) pelo protocolo de depuração (Node 22+).
 *
 *   node auditar-telas.mjs --url http://localhost:5173 [--roteiro roteiro.json] [--tamanhos ref6|P1,G2]
 *                          [--sem-deitado] [--saida pasta] [--sem-fotos]
 *
 * roteiro.json: { "url": "...", "entrar": ["js"], "sair": ["js"], "auxiliares": ["js"],
 *                 "telas": [{ "nome": "inicio", "caminho": "/", "passos": ["js"], "espera": 400, "logado": false }] }
 *   "entrar" roda antes da primeira tela que precisa de login; "sair" antes de uma tela com "logado": false;
 *   "auxiliares" roda em toda tela antes dos passos (funções de navegação reaproveitadas).
 *   Cada passo é JS avaliado na página (pode ser async); o passo que falha vira problema "passo-falhou".
 * Saída: resumo curto no terminal (para o agente ler) + relatorio.json e fotos em --saida (padrão: ./saida-telas).
 * Código de saída 1 se houver problema de severidade "erro".
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TAMANHOS = {
  P1: { largura: 360, altura: 800, dpr: 3, toque: true, nome: 'celular pequeno' },
  P2: { largura: 393, altura: 852, dpr: 3, toque: true, nome: 'celular médio' },
  M1: { largura: 768, altura: 1024, dpr: 2, toque: true, nome: 'tablet em pé' },
  M2: { largura: 1280, altura: 800, dpr: 2, toque: false, nome: 'tablet deitado / notebook pequeno' },
  G1: { largura: 1440, altura: 900, dpr: 1, toque: false, nome: 'notebook' },
  G2: { largura: 1920, altura: 1080, dpr: 1, toque: false, nome: 'monitor Full HD' },
  P1d: { largura: 800, altura: 360, dpr: 3, toque: true, nome: 'celular deitado' },
  M1d: { largura: 1024, altura: 768, dpr: 2, toque: true, nome: 'tablet deitado' },
};

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, v) => {
  if (x.startsWith('--')) a.push([x.slice(2), v[i + 1] && !v[i + 1].startsWith('--') ? v[i + 1] : true]);
  return a;
}, []));
const roteiro = args.roteiro ? JSON.parse(fs.readFileSync(args.roteiro, 'utf8')) : {};
const BASE = String(args.url || roteiro.url || 'http://localhost:5173').replace(/\/$/, '');
const TELAS = roteiro.telas || [{ nome: 'inicio', caminho: '/' }];
let nomes = !args.tamanhos || args.tamanhos === 'ref6' ? ['P1', 'P2', 'M1', 'M2', 'G1', 'G2'] : String(args.tamanhos).split(',');
if (!args['sem-deitado'] && (!args.tamanhos || args.tamanhos === 'ref6')) nomes = [...nomes, 'P1d', 'M1d'];
const SAIDA = path.resolve(args.saida || 'saida-telas');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function acharChrome() {
  const lista = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d))) lista.push(path.join(pw, d, 'chrome-linux', 'chrome'));
  return lista.find((c) => c && fs.existsSync(c));
}

async function abrir() {
  if (typeof WebSocket === 'undefined') throw new Error('Precisa do Node 22 ou mais novo (WebSocket nativo).');
  const exe = acharChrome();
  if (!exe) throw new Error('Chrome/Edge não encontrado. Defina CHROME_PATH.');
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'telas-'));
  const extra = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${perfil}`, ...extra, 'about:blank'], { stdio: 'ignore' });
  const arq = path.join(perfil, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(arq); i++) await dormir(100);
  const [porta, caminho] = fs.readFileSync(arq, 'utf8').split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${porta}${caminho}`);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let seq = 0; const pend = new Map(); const ouvir = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
    else ouvir.forEach((f) => f(m));
  };
  const cdp = (method, params = {}, sessionId) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cdp(m, p, sessionId);
  await Promise.all([s('Page.enable'), s('Runtime.enable'), s('Log.enable')]);
  const erros = [];
  ouvir.push((m) => {
    if (m.sessionId !== sessionId) return;
    // exceção e console.error são do app (erro); falha de rede/recurso pode ser esperada, como um 401 antes do login (aviso)
    if (m.method === 'Runtime.exceptionThrown') erros.push(['erro', (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]]);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erros.push(['erro', m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160)]);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') erros.push(['aviso', `${m.params.entry.text} ${m.params.entry.url || ''}`.slice(0, 160)]);
  });
  const avaliar = async (expr) => {
    const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
    return r.result.value;
  };
  const ir = async (url) => {
    const carregou = new Promise((r) => { const f = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { ouvir.splice(ouvir.indexOf(f), 1); r(); } }; ouvir.push(f); });
    await s('Page.navigate', { url });
    await Promise.race([carregou, dormir(15000)]);
  };
  const tecla = async (key, code, vk, shift) => {
    const base = { key, code, windowsVirtualKeyCode: vk, modifiers: shift ? 8 : 0 };
    await s('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await s('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };
  const fechar = () => { try { ws.close(); } catch {} proc.kill(); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} };
  return { s, avaliar, ir, tecla, erros, fechar };
}

// Roda dentro da página. Devolve a lista de problemas; nada aqui depende do framework do projeto.
const AUDITORIA = `(() => {
  const vw = innerWidth, vh = innerHeight, probs = [];
  const nome = (e) => { const t = (e.getAttribute('aria-label') || e.innerText || e.value || e.getAttribute('title') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : e.classList[0] ? '.' + e.classList[0] : '') + (t ? ' "' + t + '"' : ''); };
  // texto só para leitor de tela (1px + clip) não é "visível": não entra nas checagens visuais
  const visivel = (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
      && !/rect\\(0/.test(s.clip) && !/inset\\(50%/.test(s.clipPath) && !e.closest('[aria-hidden="true"],[inert]'); };
  const fixo = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p).position; if (s === 'fixed' || s === 'sticky') return p; } return null; };
  // modal aberto: o que está atrás fica coberto de propósito; só se confere o que está dentro dele
  const modal = [...document.querySelectorAll('dialog[open],[role=dialog],[aria-modal=true],[class*=modal]')].find((m) => visivel(m) && fixo(m));
  const recortado = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
  const todos = [...document.body.querySelectorAll('*')].filter((e) => !e.closest('svg') && !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|BR)$/.test(e.tagName));
  const vis = todos.filter(visivel);
  if (document.documentElement.scrollWidth > vw + 1) probs.push(['erro', 'rolagem-lateral', 'página ' + document.documentElement.scrollWidth + 'px > tela ' + vw + 'px']);
  const fora = vis.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !recortado(e); });
  fora.filter((e) => !fora.some((o) => o !== e && o.contains(e))).slice(0, 8).forEach((e) => probs.push(['erro', 'fora-da-tela', nome(e)]));
  for (const e of vis) {
    const s = getComputedStyle(e);
    const temTexto = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (temTexto && /(hidden|clip)/.test(s.overflowX + s.overflowY) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2))
      probs.push([s.textOverflow === 'ellipsis' ? 'aviso' : 'erro', s.textOverflow === 'ellipsis' ? 'texto-com-reticencias' : 'texto-cortado', nome(e)]);
    if (temTexto && parseFloat(s.fontSize) < 12) probs.push(['aviso', 'fonte-pequena', nome(e) + ' ' + s.fontSize]);
  }
  const interativos = vis.filter((e) => e.matches('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=menuitem],[tabindex]:not([tabindex="-1"])')
    && (!modal || modal.contains(e)));
  const toque = matchMedia('(pointer: coarse)').matches;
  for (const e of interativos) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    const emLinha = e.tagName === 'A' && s.display === 'inline';
    // caixinha de marcar dentro de um label: o alvo de toque é o label inteiro
    const alvo = [r, ...[...(e.labels || [])].map((l) => l.getBoundingClientRect())].reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    const tam = Math.round(alvo.width) + 'x' + Math.round(alvo.height);
    // WCAG 2.2 (2.5.8): mínimo 24x24, com exceção por espaçamento -> erro no toque, aviso no mouse. 44x44 é a meta no toque.
    if (!emLinha && (alvo.width < 24 || alvo.height < 24)) probs.push([toque ? 'erro' : 'aviso', 'alvo-menor-que-24', nome(e) + ' ' + tam]);
    else if (!emLinha && toque && (alvo.width < 44 || alvo.height < 44)) probs.push(['aviso', 'alvo-menor-que-44', nome(e) + ' ' + tam]);
    const acessivel = (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.innerText || e.value || e.getAttribute('alt') || (e.labels && e.labels.length) || e.querySelector('img[alt]:not([alt=""]),svg title')) ;
    if (!acessivel && !(e.tagName === 'INPUT' && /^(submit|button)$/.test(e.type) && e.value)) probs.push(['erro', 'sem-nome-acessivel', nome(e)]);
    if (r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw) {
      const x = r.left + r.width / 2, y = r.top + r.height / 2, em = document.elementFromPoint(x, y);
      if (em && em !== e && !e.contains(em) && !em.contains(e) && !(e.labels && [...e.labels].some((l) => l.contains(em)))) {
        // atrás de barra fixa (topo/rodapé) costuma sair ao rolar: aviso. Coberto por algo que rola junto: erro.
        const barra = fixo(em) && !fixo(e);
        probs.push([barra ? 'aviso' : 'erro', barra ? 'atras-de-barra-fixa' : 'coberto', nome(e) + ' por ' + nome(em)]);
      }
    }
  }
  vis.filter((e) => e.tagName === 'IMG' && !e.hasAttribute('alt')).slice(0, 5).forEach((e) => probs.push(['erro', 'imagem-sem-alt', e.src.split('/').pop()]));
  const rgb = (c) => (c.match(/[\\d.]+/g) || [0, 0, 0, 0]).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fundo = (e) => { const pilha = [];
    for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.backgroundImage !== 'none') return null; const c = rgb(s.backgroundColor); if (c[3] === undefined) c[3] = 1; if (c[3] > 0) { pilha.push(c); if (c[3] >= 1) break; } }
    return pilha.reverse().reduce((b, c) => [0, 1, 2].map((i) => c[i] * c[3] + b[i] * (1 - c[3])), [255, 255, 255]); };
  let contados = 0;
  for (const e of vis) {
    if (contados > 400) break;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    contados++;
    const s = getComputedStyle(e), b = fundo(e); if (!b) continue;
    const c = rgb(s.color), a = c[3] === undefined ? 1 : c[3], cor = [0, 1, 2].map((i) => c[i] * a + b[i] * (1 - a));
    const l1 = lum(cor), l2 = lum(b), razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (razao < minimo && !e.closest('button:disabled,[aria-disabled="true"],input:disabled')) probs.push([razao < 3 ? 'erro' : 'aviso', 'contraste', nome(e) + ' ' + razao.toFixed(2) + ':1 (mín. ' + minimo + ')']);
  }
  return probs;
})()`;

const FOCO = `(() => { const e = document.activeElement; if (!e || e === document.body) return null;
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  const dialogo = document.querySelector('dialog[open],[role=dialog]:not([hidden]),[aria-modal=true]');
  return { nome: e.tagName.toLowerCase() + (e.id ? '#' + e.id : e.classList[0] ? '.' + e.classList[0] : ''),
    indicador: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none',
    naTela: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    saiuDoDialogo: !!dialogo && !dialogo.contains(e) }; })()`;

async function main() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await abrir();
  const relatorio = [];
  let logado = false;
  try {
    for (const t of nomes) {
      const tam = TAMANHOS[t];
      if (!tam) throw new Error('Tamanho desconhecido: ' + t);
      await b.s('Emulation.setDeviceMetricsOverride', { width: tam.largura, height: tam.altura, deviceScaleFactor: tam.dpr, mobile: tam.toque });
      await b.s('Emulation.setTouchEmulationEnabled', tam.toque ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      await b.s('Emulation.setEmitTouchEventsForMouse', { enabled: tam.toque, configuration: tam.toque ? 'mobile' : 'desktop' });
      for (const tela of TELAS) {
        const querLogin = tela.logado !== false;
        if (querLogin !== logado && (querLogin ? roteiro.entrar : roteiro.sair)) {
          await b.ir(BASE + '/');
          for (const js of querLogin ? roteiro.entrar : roteiro.sair) await b.avaliar(js);
          logado = querLogin;
        }
        b.erros.length = 0;
        await b.ir(BASE + (tela.caminho || '/'));
        await dormir(tela.espera ?? 400);
        const probs = [];
        try {
          for (const js of roteiro.auxiliares || []) await b.avaliar(js);
          for (const js of tela.passos || []) { await b.avaliar(js); await dormir(250); }
        } catch (e) { probs.push(['erro', 'passo-falhou', e.message.slice(0, 120)]); }
        await dormir(200);
        probs.push(...await b.avaliar(AUDITORIA));
        const semIndicador = new Set();
        for (let i = 0; i < 12; i++) {
          await b.tecla('Tab', 'Tab', 9);
          const f = await b.avaliar(FOCO);
          if (!f) continue;
          if (!f.indicador) semIndicador.add(f.nome);
          if (!f.naTela) probs.push(['aviso', 'foco-fora-da-tela', f.nome]);
          if (f.saiuDoDialogo) { probs.push(['erro', 'foco-saiu-do-modal', f.nome]); break; }
        }
        [...semIndicador].slice(0, 5).forEach((n) => probs.push(['aviso', 'foco-sem-contorno', n]));
        b.erros.forEach(([sev, m]) => probs.push([sev, sev === 'erro' ? 'erro-no-console' : 'falha-de-rede', m]));
        if (!args['sem-fotos']) {
          const { data } = await b.s('Page.captureScreenshot', { format: 'png' });
          fs.mkdirSync(path.join(SAIDA, t), { recursive: true });
          fs.writeFileSync(path.join(SAIDA, t, `${tela.nome}.png`), Buffer.from(data, 'base64'));
        }
        const unicos = [...new Map(probs.map((p) => [p.join('|'), p])).values()];
        relatorio.push({ tamanho: t, dimensao: `${tam.largura}x${tam.altura}`, tela: tela.nome, problemas: unicos });
      }
    }
  } finally { b.fechar(); }
  fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify({ base: BASE, tamanhos: Object.fromEntries(nomes.map((n) => [n, TAMANHOS[n]])), relatorio }, null, 1));
  // Resumo curto (é o que o agente lê): o mesmo problema em vários tamanhos vira uma linha só.
  // Detalhes completos ficam no relatorio.json.
  const grupos = new Map();
  for (const r of relatorio) for (const [sev, tipo, det] of r.problemas) {
    const k = `${sev}|${tipo}|${r.tela}|${det}`;
    if (!grupos.has(k)) grupos.set(k, { sev, tipo, tela: r.tela, det, onde: [] });
    grupos.get(k).onde.push(r.tamanho);
  }
  const lista = [...grupos.values()];
  const contar = (sev) => Object.entries(lista.filter((g) => g.sev === sev).reduce((a, g) => ({ ...a, [g.tipo]: (a[g.tipo] || 0) + 1 }), {}))
    .sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ${n}`).join(', ') || 'nenhum';
  const erros = lista.filter((g) => g.sev === 'erro');
  console.log(`${relatorio.length} combinações tela×tamanho (${nomes.join(', ')}). Fotos e detalhes: ${SAIDA}`);
  console.log(`Erros distintos: ${contar('erro')}\nAvisos distintos: ${contar('aviso')}`);
  erros.slice(0, 40).forEach((g) => console.log(`- [${g.tipo}] ${g.tela} @ ${g.onde.join(',')}: ${g.det}`));
  if (erros.length > 40) console.log(`... mais ${erros.length - 40} erros no relatorio.json`);
  process.exitCode = erros.length ? 1 : 0;
}

main().catch((e) => { console.error(e.message); process.exitCode = 2; });
