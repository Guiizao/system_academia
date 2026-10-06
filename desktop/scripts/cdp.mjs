/**
 * Dirige o painel do Electron pelo protocolo do DevTools (so para testes).
 * Uso: node scripts/cdp.mjs <porta> "<expressao JS no painel>"   |   --screenshot <arquivo>
 */
const [porta, alvo, extra] = process.argv.slice(2);
const paginas = await (await fetch(`http://localhost:${porta}/json`)).json();
const painel = paginas.find((p) => p.type === 'page' && p.url.includes('painel'));
if (!painel) { console.error('painel nao encontrado'); process.exit(1); }

const ws = new WebSocket(painel.webSocketDebuggerUrl);
let id = 0; const pendentes = new Map();
ws.onmessage = (m) => { const r = JSON.parse(m.data); pendentes.get(r.id)?.(r); };
const enviar = (method, params = {}) => new Promise((ok) => { pendentes.set(++id, ok); ws.send(JSON.stringify({ id, method, params })); });
await new Promise((ok) => { ws.onopen = ok; });

if (alvo === '--screenshot') {
  const { writeFileSync } = await import('node:fs');
  await enviar('Page.bringToFront');
  // altura opcional: estica a area para caber a pagina inteira
  const altura = Number(process.argv[5] ?? 0);
  if (altura) await enviar('Emulation.setDeviceMetricsOverride', { width: 980, height: altura, deviceScaleFactor: 1, mobile: false });
  await new Promise((ok) => setTimeout(ok, 400));
  const r = await enviar('Page.captureScreenshot', { format: 'png' });
  if (altura) await enviar('Emulation.clearDeviceMetricsOverride');
  writeFileSync(extra, Buffer.from(r.result.data, 'base64'));
  console.log('screenshot salvo em', extra);
} else {
  const r = await enviar('Runtime.evaluate', { expression: `(async () => { ${alvo} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.log('ERRO:', r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
  else console.log(JSON.stringify(r.result?.result?.value, null, 2));
}
ws.close();
