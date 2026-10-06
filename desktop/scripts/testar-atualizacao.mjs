/**
 * Testa o ATUALIZAR.bat de verdade: aplica o zip sobre uma copia da
 * instalacao 0.1.1 (desktop/referencia-0.1.1), em %TEMP%, com os dados
 * isolados -- nada encosta na instalacao nem nos dados reais.
 *
 * Uso: node scripts/testar-atualizacao.mjs [--rapido]
 * (--rapido pula os dois casos que precisam abrir o programa)
 */
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'));
const ZIP = join(desktop, 'instalador', 'atualizacao', `DARK-FISIC-Atualizacao-${pkg.version}`);
const REFERENCIA = join(desktop, 'referencia-0.1.1');
const RAIZ = join(tmpdir(), 'df-teste-atualizacao');
const PORTA = 3098;
const rapido = process.argv.includes('--rapido');

let falhas = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const falhou = (msg) => { console.error(`  FALHOU  ${msg}`); falhas++; };
const conferir = (condicao, msg) => (condicao ? ok(msg) : falhou(msg));

if (!existsSync(ZIP)) { console.error(`rode "npm run atualizacao" antes (nao achei ${ZIP})`); process.exit(1); }
if (!existsSync(REFERENCIA)) { console.error(`nao achei ${REFERENCIA}`); process.exit(1); }

/** Instalacao 0.1.1 limpa + pacote de atualizacao novo, tudo em %TEMP%. */
function montarCenario(nome) {
  const base = join(RAIZ, nome);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  const instalacao = join(base, 'DARK FISIC');
  cpSync(REFERENCIA, instalacao, { recursive: true });
  cpSync(ZIP, join(base, 'atualizacao'), { recursive: true });
  const dados = join(base, 'DarkFisic');
  mkdirSync(join(dados, 'dados'), { recursive: true });
  return { base, instalacao, atualizacao: join(base, 'atualizacao'), dados };
}

const ambiente = (c) => ({ ...process.env, LOCALAPPDATA: c.base, DF_DADOS: c.dados, DF_PORTA: String(PORTA) });

/** Abre a instalacao e espera o /status -- e assim que o banco de verdade nasce. */
async function abrirApp(c, segundos = 60) {
  const p = spawn(join(c.instalacao, 'DARK FISIC.exe'), ['--oculto'], {
    env: ambiente(c), detached: true, stdio: 'ignore', windowsHide: true,
  });
  p.unref();
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return await r.json();
    } catch { /* ainda subindo */ }
    await new Promise((ok2) => setTimeout(ok2, 1000));
  }
  return null;
}

function rodarBat(c, segundos = 180) {
  // LOCALAPPDATA: o .ps1 guarda backup, log e importar aqui dentro.
  // DF_DADOS: o app usa a mesma pasta (e trava de instancia propria).
  const r = spawnSync('cmd.exe', ['/c', join(c.atualizacao, 'ATUALIZAR.bat'), c.instalacao], {
    env: { ...ambiente(c), PROMPT: '$G' },
    encoding: 'utf8', timeout: segundos * 1000, windowsHide: true,
    input: '\r\n',                // responde ao "pause" do .bat
  });
  return { codigo: r.status, saida: (r.stdout ?? '') + (r.stderr ?? '') };
}

function versaoInstalada(c) {
  return JSON.parse(readFileSync(join(c.instalacao, 'resources', 'app', 'package.json'), 'utf8')).version;
}
/**
 * Fecha o app do cenario e so volta quando a porta esta livre. Depois de
 * desfazer, o atualizador REABRE o sistema -- sem esperar aqui, o cenario
 * seguinte encontraria a porta ocupada.
 */
async function encerrarApp(c, segundos = 30) {
  const limite = Date.now() + segundos * 1000;
  do {
    try {
      execFileSync('powershell', ['-NoProfile', '-Command',
        `Get-Process -Name 'DARK FISIC' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith('${c.instalacao.replaceAll("'", "''")}') } | Stop-Process -Force`,
      ], { stdio: 'ignore' });
    } catch { /* ja saiu */ }
    try {
      await fetch(`http://localhost:${PORTA}/status`, { signal: AbortSignal.timeout(1500) });
    } catch { return; }  // ninguem respondeu: porta livre
    await new Promise((ok2) => setTimeout(ok2, 1000));
  } while (Date.now() < limite);
  falhou('sobrou um DARK FISIC no ar depois do cenario');
}
/** Mexe no pacote e refaz o hash, para o teste nao esbarrar na conferencia por engano. */
function trocarNoPacote(c, relativo, conteudo) {
  const pacote = join(c.atualizacao, 'pacote');
  writeFileSync(join(pacote, relativo), conteudo);
  const manifesto = JSON.parse(readFileSync(join(pacote, 'atualizacao.json'), 'utf8'));
  const alvo = manifesto.arquivos.find((a) => a.caminho === relativo);
  alvo.sha256 = createHash('sha256').update(Buffer.from(conteudo)).digest('hex').toUpperCase();
  writeFileSync(join(pacote, 'atualizacao.json'), JSON.stringify(manifesto, null, 2));
}

console.log(`\nTestando a atualizacao ${pkg.version} sobre a 0.1.1 em ${RAIZ}\n`);

// --- versao igual ou mais nova: nao mexe em nada (codigo 2) ----------------
{
  console.log('1) a instalacao ja esta na versao nova');
  const c = montarCenario('mesma-versao');
  const app = join(c.instalacao, 'resources', 'app', 'package.json');
  writeFileSync(app, readFileSync(app, 'utf8').replace('"0.1.1"', `"${pkg.version}"`));
  const r = rodarBat(c, 60);
  conferir(r.codigo === 2, `codigo 2 (veio ${r.codigo})`);
  conferir(versaoInstalada(c) === pkg.version, 'a instalacao ficou intacta');
}

// --- bibliotecas diferentes: manda usar o instalador (codigo 3) ------------
{
  console.log('2) as bibliotecas mudaram');
  const c = montarCenario('deps-diferentes');
  const manifesto = join(c.atualizacao, 'pacote', 'atualizacao.json');
  const m = JSON.parse(readFileSync(manifesto, 'utf8'));
  m.dependencias = { ...m.dependencias, fastify: '^9.0.0' };
  writeFileSync(manifesto, JSON.stringify(m, null, 2));
  const r = rodarBat(c, 60);
  conferir(r.codigo === 3, `codigo 3 (veio ${r.codigo})`);
  conferir(versaoInstalada(c) === '0.1.1', 'a instalacao continua 0.1.1');
}

// --- arquivo corrompido: recusa antes de copiar (codigo 4) ----------------
{
  console.log('3) arquivo do pacote corrompido');
  const c = montarCenario('corrompido');
  writeFileSync(join(c.atualizacao, 'pacote', 'main.js'), '// trocado depois do hash');
  const r = rodarBat(c, 60);
  conferir(r.codigo === 4, `codigo 4 (veio ${r.codigo})`);
  conferir(versaoInstalada(c) === '0.1.1', 'a instalacao continua 0.1.1');
}

if (!rapido) {
  // --- caminho feliz ------------------------------------------------------
  {
    console.log('4) atualizacao completa (com o sistema rodando, como na academia)');
    const c = montarCenario('feliz');
    const nativo = join(c.instalacao, 'resources', 'app', 'node_modules', 'better-sqlite3', 'prebuilds', 'win32-x64.node');
    const antes = existsSync(nativo) ? readFileSync(nativo).length : -1;
    const noAr = await abrirApp(c);
    conferir(noAr?.versao === '0.1.1', `0.1.1 no ar antes de atualizar (veio ${noAr?.versao})`);
    const r = rodarBat(c);
    await encerrarApp(c);
    conferir(r.codigo === 0, `codigo 0 (veio ${r.codigo})`);
    conferir(versaoInstalada(c) === pkg.version, `a instalacao virou ${pkg.version}`);
    conferir(/atualizado para a versao/i.test(r.saida), 'confirmou a versao pelo /status');
    conferir(existsSync(nativo) && readFileSync(nativo).length === antes, 'better_sqlite3.node intacto');
    const backups = existsSync(join(c.dados, 'backups')) ? readdirSync(join(c.dados, 'backups')) : [];
    conferir(backups.some((n) => n.startsWith('antes-da-atualizacao-')), 'copia do banco guardada');
    conferir(existsSync(join(c.dados, 'logs', 'atualizacao.log')), 'log escrito');
    // o pacote so leva alunos quando gerado com --alunos; sem isso nao ha o que entregar
    const noPacote = readdirSync(join(c.atualizacao, 'pacote')).some((n) => n.startsWith('alunos-planilha'));
    if (noPacote) {
      const importar = existsSync(join(c.dados, 'importar')) ? readdirSync(join(c.dados, 'importar')) : [];
      conferir(importar.some((n) => n.startsWith('alunos-planilha.json')), 'arquivo de alunos entregue na pasta importar');
    }
    conferir(existsSync(join(c.dados, 'atualizacoes', 'anterior-0.1.1', 'main.js')), 'versao anterior guardada');
  }

  // --- programa novo nao sobe: desfaz sozinho ------------------------------
  {
    console.log('5) a versao nova nao sobe: tem que desfazer');
    const c = montarCenario('rollback');
    await abrirApp(c);
    // sai em silencio: um throw aqui faria o Electron abrir uma caixa de erro
    // na cara de quem esta usando o PC enquanto o teste roda
    trocarNoPacote(c, 'main.js', 'process.exit(1);\n');
    const r = rodarBat(c, 240);
    await encerrarApp(c);
    conferir(r.codigo === 5, `codigo 5 (veio ${r.codigo})`);
    conferir(versaoInstalada(c) === '0.1.1', 'voltou para a 0.1.1');
    const banco = join(c.dados, 'dados', 'academia.db');
    conferir(existsSync(banco) && readFileSync(banco).subarray(0, 15).toString() === 'SQLite format 3', 'banco intacto');
    const copia = readdirSync(join(c.dados, 'backups')).find((n) => n.startsWith('antes-da-atualizacao-'));
    conferir(!!copia, 'copia do banco guardada antes de desfazer');
  }

  // --- o caso perigoso: a versao nova ABRE o banco e so depois falha --------
  {
    console.log('6) versao nova mexe no banco e so depois falha (o banco nao pode corromper)');
    const c = montarCenario('rollback-com-banco');
    await abrirApp(c);
    // marca o banco com o programa no ar: assim o registro fica no -wal, que e
    // onde o SQLite escreve primeiro. Se o rollback devolver so o .db, some.
    const Database = createRequire(join(desktop, '..', 'api', 'package.json'))('better-sqlite3');
    {
      const vivo = new Database(join(c.dados, 'dados', 'academia.db'));
      vivo.prepare("insert into usuario (nome, email, papel) values ('Marcador', 'marcador@teste', 'dono')").run();
      vivo.close();
    }
    // o pacote se diz 0.1.3, mas o programa dentro dele e 0.1.2: sobe, usa o
    // banco (deixa -wal) e o /status nunca bate com o esperado
    const manifesto = join(c.atualizacao, 'pacote', 'atualizacao.json');
    const m = JSON.parse(readFileSync(manifesto, 'utf8'));
    // uma versao acima da que o programa realmente tem, qualquer que seja ela
    const [maior, menor, correcao] = pkg.version.split('.').map(Number);
    m.versao = `${maior}.${menor}.${correcao + 1}`;
    writeFileSync(manifesto, JSON.stringify(m, null, 2));
    const r = rodarBat(c, 240);
    await encerrarApp(c);
    conferir(r.codigo === 5, `codigo 5 (veio ${r.codigo})`);
    conferir(versaoInstalada(c) === '0.1.1', 'voltou para a 0.1.1');
    // o SQLite grava primeiro no -wal: um rollback que devolva so o .db deixa
    // o banco abrivel e VAZIO. Por isso conferimos o conteudo, nao so o arquivo.
    let integridade = 'nao abriu', marcador = -1, erro = null;
    try {
      const banco = new Database(join(c.dados, 'dados', 'academia.db'), { readonly: true });
      integridade = banco.pragma('integrity_check', { simple: true });
      marcador = banco.prepare("select count(*) c from usuario where email = 'marcador@teste'").get().c;
      banco.close();
    } catch (e) { erro = e.message; }
    conferir(integridade === 'ok', `banco integro depois de desfazer (${erro ?? integridade})`);
    conferir(marcador === 1, `o registro gravado antes da atualizacao sobreviveu (achei ${marcador})`);
  }
}

console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} verificacao(oes) falharam.\n`);
if (falhas === 0) rmSync(RAIZ, { recursive: true, force: true });
process.exitCode = falhas === 0 ? 0 : 1;
