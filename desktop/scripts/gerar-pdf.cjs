/**
 * HTML -> PDF (A4) com o Chromium do Electron: mesma fonte e mesmas cores do sistema.
 * Uso: electron scripts/gerar-pdf.cjs <entrada.html> <saida.pdf>
 */
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const [entrada, saida] = process.argv.slice(2).map((p) => resolve(p));
  const w = new BrowserWindow({ show: false, width: 1240, height: 1754, webPreferences: { offscreen: true } });
  await w.loadURL(pathToFileURL(entrada).href);
  // espera fontes e imagens: PDF com fonte substituta seria outro documento
  await w.webContents.executeJavaScript(`Promise.all([document.fonts.ready,
    ...[...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))]).then(() => true)`);
  const faltando = await w.webContents.executeJavaScript(`[...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'))`);
  if (faltando.length) { console.error('IMAGENS NAO ENCONTRADAS:', faltando.join(', ')); app.exit(1); return; }
  const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
  writeFileSync(saida, pdf);
  console.log('PDF gerado:', saida, `(${Math.round(pdf.length / 1024)} KB)`);
  app.quit();
});
