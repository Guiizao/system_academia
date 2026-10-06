/**
 * Gera todos os icones a partir da logo (build/logo.svg e logo-mascaravel.svg).
 * Cada tamanho e DESENHADO no tamanho final (nao reduzido de uma imagem grande):
 * e o que deixa o icone de 16 px da bandeja nitido.
 *
 * Uso: npm run icones   (electron scripts/gerar-icones.cjs)
 */
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const desktop = join(__dirname, '..');
const publico = join(desktop, '..', 'web', 'public');
const logo = readFileSync(join(desktop, 'build', 'logo.svg'), 'utf8');
const mascaravel = readFileSync(join(desktop, 'build', 'logo-mascaravel.svg'), 'utf8');

// [svg, tamanho, destinos]
const ALVOS = [
  [logo, 16, [join(desktop, 'painel', 'icone-bandeja.png')]],
  [logo, 24, []],
  [logo, 32, [join(desktop, 'painel', 'icone-bandeja@2x.png'), join(publico, 'favicon.png')]],
  [logo, 48, []],
  [logo, 64, []],
  [logo, 128, []],
  [logo, 256, [join(desktop, 'painel', 'icone.png')]],
  [logo, 192, [join(publico, 'icone-192.png')]],
  [logo, 512, [join(publico, 'icone-512.png')]],
  [mascaravel, 180, [join(publico, 'apple-touch-icon.png')]],
  [mascaravel, 512, [join(publico, 'icone-mascaravel-512.png')]],
];
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256];

/** .ico com PNG dentro de cada entrada (aceito pelo Windows desde o Vista). */
function montarIco(pngs) {
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let deslocamento = 6 + 16 * pngs.length;
  pngs.forEach(({ px, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(px >= 256 ? 0 : px, o);       // 0 significa 256
    dir.writeUInt8(px >= 256 ? 0 : px, o + 1);
    dir.writeUInt16LE(1, o + 4);                  // planos
    dir.writeUInt16LE(32, o + 6);                 // bits por pixel
    dir.writeUInt32LE(buf.length, o + 8);
    dir.writeUInt32LE(deslocamento, o + 12);
    deslocamento += buf.length;
  });
  return Buffer.concat([cab, dir, ...pngs.map((p) => p.buf)]);
}

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  // todos lado a lado numa janela invisivel; cada um e recortado no seu tamanho exato
  let x = 0;
  const pos = ALVOS.map(([svg, px]) => { const p = { svg, px, x }; x += px + 8; return p; });
  const html = `<!doctype html><html><head><style>
    html, body { margin: 0; background: transparent; }
    div { position: absolute; top: 0; } svg { display: block; width: 100%; height: 100%; }
  </style></head><body>${pos.map((p) => `<div style="left:${p.x}px;width:${p.px}px;height:${p.px}px">${p.svg}</div>`).join('')}</body></html>`;

  const w = new BrowserWindow({
    show: false, width: x, height: 520, frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: true },
  });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((ok) => setTimeout(ok, 400));

  const paraIco = [];
  for (const [i, p] of pos.entries()) {
    const img = await w.webContents.capturePage({ x: p.x, y: 0, width: p.px, height: p.px });
    const { width, height } = img.getSize();
    if (width !== p.px || height !== p.px) throw new Error(`tamanho errado: pedi ${p.px}, veio ${width}x${height}`);
    const buf = img.toPNG();
    for (const destino of ALVOS[i][2]) { writeFileSync(destino, buf); console.log(`  ${p.px}px -> ${destino}`); }
    if (p.svg === logo && TAMANHOS_ICO.includes(p.px) && !paraIco.some((e) => e.px === p.px)) paraIco.push({ px: p.px, buf });
  }
  paraIco.sort((a, b) => a.px - b.px);
  writeFileSync(join(desktop, 'build', 'icone.ico'), montarIco(paraIco));
  console.log(`  ico (${paraIco.map((e) => e.px).join(', ')}) -> build/icone.ico`);
  app.exit(0);
}).catch((e) => { console.error('FALHOU:', e.message); app.exit(1); });
