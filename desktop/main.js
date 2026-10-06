/**
 * DARK FISIC - app do PC que HOSPEDA o sistema.
 * O servidor (Fastify + SQLite) roda DENTRO deste processo: nao ha Node,
 * banco ou servico para instalar a parte. Fechar a janela nao derruba o
 * servidor -- ele segue na bandeja do Windows ate "Encerrar".
 */
import { app, BrowserWindow, ipcMain, Tray, Menu, shell, nativeImage } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import QRCode from 'qrcode';
import { lerInicioWindows, gravarInicioWindows } from './sistema/inicio-windows.js';
import { linkExternoPermitido, ehOSistema } from './sistema/links.js';
import { mensagemImportacao } from './sistema/importacao.js';
import { criarTunel } from './sistema/tunel.js';
import { spawn } from 'node:child_process';

const aqui = dirname(fileURLToPath(import.meta.url));
// O servidor mora em <app>/app/servidor, na MESMA arvore do node_modules do app
// (empacotado sem asar). Assim o import de 'fastify', 'better-sqlite3' etc.
// resolve pela regra normal do Node. Com o servidor fora do asar e as
// bibliotecas dentro dele, a instalacao real nao achava nenhuma dependencia.
const APP = join(app.getAppPath(), 'app');
const importar = (p) => import(pathToFileURL(join(APP, 'servidor', p)).href);
// a versao que o sistema mostra (Configuracoes > Servidor) e a do app instalado
process.env.DF_VERSAO = app.getVersion();

// Banco em %LOCALAPPDATA%: local e fora do OneDrive. Sincronizar um SQLite
// aberto (com WAL) corrompe o banco.
const BASE = process.env.DF_DADOS ?? join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'DarkFisic');
// pasta de dados alternativa = instancia isolada (teste do pacote): sem isso a
// trava de instancia unica fecharia o teste se o DARK FISIC de verdade estiver aberto
if (process.env.DF_DADOS) app.setPath('userData', join(process.env.DF_DADOS, 'electron'));
// importar: arquivo de alunos colocado aqui entra no banco quando o servidor sobe (sem botao)
const PASTAS = {
  dados: join(BASE, 'dados'), backups: join(BASE, 'backups'), logs: join(BASE, 'logs'), importar: join(BASE, 'importar'),
};
Object.values(PASTAS).forEach((p) => mkdirSync(p, { recursive: true }));
const CAMINHO_BANCO = join(PASTAS.dados, 'academia.db');
const PORTA = Number(process.env.DF_PORTA ?? 3000);

let servidor = null;          // { parar, urls, sqlite, db }
// o tunel da internet; so sobe quando alguem clica no painel
const tunel = criarTunel({ spawn, log: (m, t) => log(m, t) });
let painel = null, janelaSistema = null, bandeja = null;
let saindo = false;
const logs = [];

function log(msg, nivel = 'info') {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${nivel.toUpperCase()} ${msg}`;
  logs.push(linha); if (logs.length > 300) logs.shift();
  try { appendFileSync(join(PASTAS.logs, 'darkfisic.log'), linha + '\n'); } catch {}
  painel?.webContents.send('log', linha);
}

/** Enderecos atuais. Recalculado sempre: se o Wi-Fi conectar depois, aparece sozinho. */
async function urlsAtuais() {
  if (!servidor) return [];
  const { ipsLocais } = await importar('index.js');
  return [`http://localhost:${PORTA}`, ...ipsLocais().map((ip) => `http://${ip}:${PORTA}`)];
}

async function estado() {
  return {
    rodando: !!servidor,
    urls: await urlsAtuais(),
    pastas: PASTAS,
    iniciarComWindows: lerInicioWindows(app),
    precisaConfigurar: servidor ? (await importar('servicos/primeiro-acesso.js')).precisaConfigurar(servidor.db) : null,
    backups: (await importar('servicos/backup.js')).listarBackups(PASTAS.backups).slice(0, 8),
    tunel: tunel.estado(),
    versao: app.getVersion(),
  };
}
const avisarPainel = async () => painel?.webContents.send('estado', await estado());

async function iniciarServidor() {
  if (servidor) return;
  try {
    const { iniciar } = await importar('index.js');
    process.env.DF_MIGRATIONS = join(APP, 'drizzle');
    servidor = await iniciar({ porta: PORTA, caminhoBanco: CAMINHO_BANCO, pastaWeb: join(APP, 'web'), logger: false });
    log(`Servidor no ar: ${servidor.urls.join('  ')}`);
    await importarPendentes();
  } catch (e) {
    servidor = null;
    log(e.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso por outro programa.` : `Falha ao iniciar: ${e.message}`, 'erro');
  }
  atualizarBandeja(); await avisarPainel();
}

/** Arquivos da pasta "importar" entram no banco, com backup antes. Erro em um arquivo nao derruba o servidor. */
async function importarPendentes() {
  if (!servidor) return;
  try {
    const { importarDaPasta } = await importar('servicos/importacao.js');
    const { fazerBackup } = await importar('servicos/backup.js');
    const resultados = importarDaPasta(servidor.db, PASTAS.importar, {
      fazerBackup: () => fazerBackup(servidor.sqlite, PASTAS.backups, new Date(), 'antes-da-importacao'),
    });
    for (const r of resultados) log(mensagemImportacao(r), r.situacao === 'erro' ? 'erro' : 'info');
  } catch (e) {
    log(`Importação falhou: ${e.message}`, 'erro');
  }
}

async function pararServidor() {
  if (!servidor) return;
  await servidor.parar(); servidor = null;
  log('Servidor parado. Celulares e outros PCs perderam o acesso.');
  atualizarBandeja(); await avisarPainel();
}

async function backupAgora(motivo = 'manual', prefixo = 'darkfisic') {
  if (!servidor) throw new Error('Inicie o servidor para fazer backup');
  const { fazerBackup, aplicarRetencao } = await importar('servicos/backup.js');
  const arquivo = fazerBackup(servidor.sqlite, PASTAS.backups, new Date(), prefixo);
  const apagados = aplicarRetencao(PASTAS.backups);
  log(`Backup ${motivo}: ${arquivo.split(/[\/]/).pop()}${apagados.length ? ` (${apagados.length} antigo(s) removido(s) pela retenção)` : ''}`);
  await avisarPainel();
  return arquivo;
}

// o painel acompanha mudancas de rede sem precisar reiniciar nada
setInterval(() => { avisarPainel().catch(() => {}); }, 15 * 1000);

// Backup automatico: um por dia, na primeira checagem depois das 3h
// (ou no boot, se o PC passou a madrugada desligado).
let ultimoBackupDia = null;
setInterval(async () => {
  const agora = new Date(), dia = agora.toDateString();
  if (servidor && agora.getHours() >= 3 && ultimoBackupDia !== dia) {
    ultimoBackupDia = dia;
    try { await backupAgora('automático'); } catch (e) { log(`Backup automático falhou: ${e.message}`, 'erro'); }
  }
}, 10 * 60 * 1000);

/* ─── janelas sem a moldura do Windows ───────────────────────────────
   A barra de titulo e desenhada pela propria pagina, na cor do sistema, com
   minimizar / tela cheia / fechar. Estes canais so mexem na janela de quem
   pediu -- nao dao acesso a mais nada. */
const FUNDO = '#111318';
const janelaDe = (e) => BrowserWindow.fromWebContents(e.sender);
ipcMain.on('janela:minimizar', (e) => janelaDe(e)?.minimize());
ipcMain.on('janela:maximizar', (e) => {
  const w = janelaDe(e);
  if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on('janela:fechar', (e) => janelaDe(e)?.close());
ipcMain.handle('janela:maximizada', (e) => janelaDe(e)?.isMaximized() ?? false);

/** Avisa a pagina quando a janela maximiza ou volta, para trocar o icone do botao. */
function acompanharMaximizar(w) {
  const avisar = () => { if (!w.isDestroyed()) w.webContents.send('janela:maximizada', w.isMaximized()); };
  w.on('maximize', avisar);
  w.on('unmaximize', avisar);
}

// Fechar nao desliga: na primeira vez, a bandeja avisa -- senao parece que o sistema saiu do ar.
let avisouBandeja = false;
function avisarQueContinua() {
  const algumaAberta = BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.isVisible());
  if (avisouBandeja || saindo || algumaAberta || !bandeja) return;
  avisouBandeja = true;
  bandeja.displayBalloon({
    iconType: 'info',
    title: 'O DARK FISIC continua ligado',
    content: 'O sistema segue no ar aqui na bandeja. Dois cliques no ícone abrem o painel.',
  });
}

function abrirSistema() {
  if (!servidor) return;
  if (janelaSistema) { janelaSistema.show(); janelaSistema.focus(); return; }
  janelaSistema = new BrowserWindow({
    width: 1440, height: 900, minWidth: 380, minHeight: 480, title: 'DARK FISIC', backgroundColor: FUNDO,
    frame: false, autoHideMenuBar: true, icon: join(aqui, 'painel', 'icone.png'),
    // o sistema e uma pagina web comum: sem Node, isolada. O preload so expoe os botoes da janela.
    webPreferences: { preload: join(aqui, 'preload-sistema.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  acompanharMaximizar(janelaSistema);
  janelaSistema.loadURL(`http://localhost:${PORTA}`);
  // link externo abre no navegador padrao, nunca dentro do app
  // (WhatsApp, por exemplo); so http/https -- nada de file: ou outro protocolo
  const abrirFora = (url) => {
    if (linkExternoPermitido(url)) shell.openExternal(url).catch((erro) => log(`Nao consegui abrir o link: ${erro.message}`, 'erro'));
  };
  janelaSistema.webContents.setWindowOpenHandler(({ url }) => { abrirFora(url); return { action: 'deny' }; });
  const sairDaPagina = (e, url) => { if (!ehOSistema(url, PORTA)) { e.preventDefault(); abrirFora(url); } };
  janelaSistema.webContents.on('will-navigate', sairDaPagina);
  janelaSistema.webContents.on('will-redirect', sairDaPagina);
  janelaSistema.webContents.on('will-frame-navigate', (e) => { if (!ehOSistema(e.url, PORTA)) e.preventDefault(); });
  janelaSistema.on('closed', () => { janelaSistema = null; avisarQueContinua(); });
}

function criarPainel() {
  painel = new BrowserWindow({
    width: 980, height: 740, minWidth: 720, minHeight: 560, title: 'DARK FISIC | Servidor',
    backgroundColor: FUNDO, frame: false, autoHideMenuBar: true, show: false,
    icon: join(aqui, 'painel', 'icone.png'),
    webPreferences: { preload: join(aqui, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  acompanharMaximizar(painel);
  painel.loadFile(join(aqui, 'painel', 'index.html'));
  painel.once('ready-to-show', () => { if (!process.argv.includes('--oculto')) painel.show(); });
  // fechar o painel NAO derruba o servidor: ele segue na bandeja
  painel.on('close', (e) => {
    if (saindo) return;
    e.preventDefault(); painel.hide();
    log('Painel minimizado para a bandeja. O servidor continua no ar.');
    avisarQueContinua();
  });
}

function atualizarBandeja() {
  if (!bandeja) return;
  bandeja.setToolTip(servidor ? 'DARK FISIC — servidor no ar' : 'DARK FISIC — servidor parado');
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: servidor ? '● Servidor no ar' : '○ Servidor parado', enabled: false },
    { type: 'separator' },
    { label: 'Abrir o sistema', enabled: !!servidor, click: abrirSistema },
    { label: 'Painel do servidor', click: () => { painel.show(); painel.focus(); } },
    { type: 'separator' },
    { label: 'Encerrar (tira o sistema do ar)', click: () => { saindo = true; app.quit(); } },
  ]));
}

ipcMain.handle('estado', () => estado());
ipcMain.handle('logs', () => logs);
ipcMain.handle('iniciar', () => iniciarServidor());
ipcMain.handle('parar', () => pararServidor());
ipcMain.handle('abrir-sistema', () => abrirSistema());
ipcMain.handle('backup', () => backupAgora('manual'));
ipcMain.handle('abrir-pasta', (_e, qual) => shell.openPath(Object.hasOwn(PASTAS, qual) ? PASTAS[qual] : BASE));
ipcMain.handle('tunel:abrir', async () => { const r = await tunel.abrir(PORTA); await avisarPainel(); return r; });
ipcMain.handle('tunel:fechar', async () => { const r = tunel.fechar(); await avisarPainel(); return r; });
ipcMain.handle('qr', (_e, url) => QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#1C2228', light: '#FFFFFF' } }));
ipcMain.handle('iniciar-com-windows', (_e, ligado) => {
  const ficou = gravarInicioWindows(app, ligado);
  log(ficou ? 'Vai iniciar junto com o Windows.' : 'Não vai mais iniciar com o Windows.');
  return ficou;
});
ipcMain.handle('primeiro-acesso', async (_e, dados) => {
  const { configurarPrimeiroAcesso } = await importar('servicos/primeiro-acesso.js');
  await configurarPrimeiroAcesso(servidor.db, dados);
  log(`Sistema configurado. Dono: ${dados.email}`);
  await importarPendentes();  // arquivo que estava esperando a conta do dono
  await avisarPainel();
});
ipcMain.handle('dados-demo', async () => {
  const { precisaConfigurar } = await importar('servicos/primeiro-acesso.js');
  // so em banco vazio: nunca apaga dados reais
  if (!precisaConfigurar(servidor.db)) throw new Error('O banco já tem dados. Demonstração só em instalação vazia.');
  const { semear } = await importar('db/seed.js');
  const r = await semear(servidor.db);
  log(`Dados de demonstração carregados: ${r.contadores.alunos} alunos. Senha de teste: darkfisic123`);
  await avisarPainel();
  return r.equipe;
});

/**
 * Apagar tudo e comecar do zero. So existe aqui, no painel do computador que
 * hospeda o sistema: ninguem na rede ou no celular consegue fazer isso.
 * Exige a frase digitada e guarda um backup antes -- se foi engano, da para voltar.
 */
ipcMain.handle('resetar-dados', async (_e, confirmacao) => {
  if (confirmacao !== 'APAGAR TUDO') throw new Error('Digite APAGAR TUDO para confirmar');
  let copia = null;
  if (servidor) { copia = await backupAgora('de segurança antes do reset', 'antes-do-reset'); await pararServidor(); }
  for (const f of ['academia.db', 'academia.db-wal', 'academia.db-shm']) {
    rmSync(join(PASTAS.dados, f), { force: true });
  }
  log(`Dados apagados. Uma cópia do banco anterior ficou em backups${copia ? ` (${copia.split(/[\/]/).pop()})` : ''}.`);
  await iniciarServidor();
  return copia;
});

// nome e icone certos nas notificacoes do Windows (o aviso da bandeja usa isto)
app.setAppUserModelId('com.darkfisic.sistema');

// "DARK FISIC.exe --encerrar" fecha o que esta rodando do jeito certo (servidor
// parado, banco fechado). E assim que o ATUALIZAR.bat tira o sistema do ar.
const PEDIU_ENCERRAR = process.argv.includes('--encerrar');

// uma instancia so: dois servidores brigariam pela porta e pelo banco
if (!app.requestSingleInstanceLock() || PEDIU_ENCERRAR) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (argv.includes('--encerrar')) { log('Encerrado pelo atualizador.'); saindo = true; app.quit(); return; }
    painel?.show(); painel?.focus();
  });
  app.whenReady().then(async () => {
    // icone desenhado no tamanho da bandeja (16 px, e 32 px em tela ampliada via @2x)
    const icone = nativeImage.createFromPath(join(aqui, 'painel', 'icone-bandeja.png'));
    bandeja = new Tray(icone.isEmpty() ? nativeImage.createEmpty() : icone);
    bandeja.on('double-click', () => { painel.show(); painel.focus(); });
    criarPainel();
    atualizarBandeja();
    // "ninguem clica em nada" (spec 9.1): o servidor sobe sozinho ao abrir o app
    await iniciarServidor();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
  app.on('before-quit', async (e) => {
    if (servidor) { e.preventDefault(); saindo = true; await pararServidor(); app.quit(); }
  });
}
