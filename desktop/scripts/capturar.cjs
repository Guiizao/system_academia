/**
 * Tira capturas do sistema numa janela invisivel do Electron, no tamanho exato.
 * Uso: electron scripts/capturar.cjs <roteiro.json>
 * Roteiro: { base, pasta, capturas: [{ nome, largura, altura, email, senha, passos: ["js", ...] }] }
 */
const { app, BrowserWindow } = require('electron');
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const roteiro = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** loadURL que tolera navegacao interrompida (acontece quando o app redireciona sozinho). */
async function carregar(w, url) {
  for (let t = 0; t < 3; t++) {
    try { await w.loadURL(url); return; }
    catch (e) { if (t === 2) throw e; await esperar(600); }
  }
}

app.disableHardwareAcceleration();
// fechar a janela de uma captura nao pode encerrar o app antes da proxima
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  mkdirSync(roteiro.pasta, { recursive: true });
  for (const c of roteiro.capturas) {
    const w = new BrowserWindow({
      show: false, width: c.largura, height: c.altura, useContentSize: true,
      backgroundColor: '#060A12', webPreferences: { offscreen: true, backgroundThrottling: false, partition: `cap-${c.nome}` },
    });
    // sem service worker nas capturas: cada janela ve o servidor de verdade
    w.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/sw.js'] }, (_d, cb) => cb({ cancel: true }));
    await carregar(w, roteiro.base);
    if (!c.semLogin) await w.webContents.executeJavaScript(`fetch('/api/auth/login', { method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify({ email: c.email, senha: c.senha })}) })`);
    await carregar(w, roteiro.base);
    await esperar(1600);
    for (const passo of c.passos ?? []) {
      const r = await w.webContents.executeJavaScript(`(async () => { ${passo} })()`).catch((e) => `ERRO ${e.message}`);
      if (typeof r === 'string' && r.startsWith('ERRO')) console.log('FALHOU', c.nome, '->', r);
      else if (r !== undefined && process.env.DF_DEBUG) console.log(c.nome, '->', r);
      await esperar(900);
    }
    await esperar(400);
    const img = await w.webContents.capturePage();
    writeFileSync(join(roteiro.pasta, `${c.nome}.png`), img.toPNG());
    console.log('capturado', c.nome);
    w.destroy();
  }
  app.quit();
});
