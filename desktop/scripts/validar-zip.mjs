// Valida o zip da versao atual FORA do projeto: instalacao 0.1.1 no TEMP, copia do banco antigo,
// atualizador oficial, sobe com o Electron do desenvolvimento e confere status, rotas e contagens.
// O .exe 0.1.1 nao abre nesta maquina (STATUS_BREAKPOINT), por isso nao usa o testar-atualizacao.
// Uso, fora da pasta do projeto: cd %TEMP% && node <projeto>/desktop/scripts/validar-zip.mjs
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desk = join(dirname(fileURLToPath(import.meta.url)), '..');
const proj = join(desk, '..');
const versao = JSON.parse(readFileSync(join(desk, 'package.json'), 'utf8')).version;
const base = join(process.env.TEMP, 'df-valida-zip');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const PORTA = 3098;
const ps = `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;

rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });
const inst = join(base, 'Instalacao');
cpSync(join(desk, 'instalador', 'win-unpacked'), inst, { recursive: true });
const zip = join(desk, 'instalador', 'atualizacao', `DARK-FISIC-Atualizacao-${versao}.zip`);
execFileSync(ps, ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${join(base, 'zip')}'`]);
const pasta = join(base, 'zip', `DARK-FISIC-Atualizacao-${versao}`);
const dados = join(base, 'DarkFisic');
mkdirSync(join(dados, 'dados'), { recursive: true });
copyFileSync(join(proj, 'api', 'backups', 'pre-migracao-2026-09-21T23-01-43-616Z.db'), join(dados, 'dados', 'academia.db'));

const env = { ...process.env, DF_DADOS: dados, DF_PORTA: String(PORTA), LOCALAPPDATA: base };
const saida = execFileSync(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(pasta, 'atualizar.ps1'), '-Destino', inst, '-Pacote', join(pasta, 'pacote'), '-SemReiniciar'], { env, encoding: 'utf8' });
console.log(saida.trim().split('\n').slice(-3).join(' | '));
const app = join(inst, 'resources', 'app');
console.log('instalada agora:', JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).version, '| node_modules:', existsSync(join(app, 'node_modules', 'better-sqlite3')));

const electron = join(desk, 'node_modules', 'electron', 'dist', 'electron.exe');
const p = spawn(electron, [app, '--oculto'], { env, cwd: base, stdio: 'ignore', windowsHide: true });
try {
  const t0 = Date.now();
  let status = null;
  for (let i = 0; i < 90 && !status; i++) {
    try { const r = await fetch(`http://localhost:${PORTA}/status`, { signal: AbortSignal.timeout(2000) }); if (r.ok) status = await r.json(); } catch {}
    if (!status) await espera(1000);
  }
  if (!status) throw new Error('NAO SUBIU em 90s');
  console.log(`subiu em ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(status));
  for (const rota of ['/api/alunos/1/vendas', '/api/alunos/1/periodos']) console.log(rota, '->', (await fetch(`http://localhost:${PORTA}${rota}`)).status, '(sem login: 401, nao 404)');
  await espera(500);
  const conta = ['aluno', 'pagamento', 'matricula', 'cobranca', '__drizzle_migrations'].map((t) => `select '${t}', count(*) from ${t}`).join(' union all ');
  const py = `import sqlite3,sys\nc=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)\nprint(dict(c.execute(sys.argv[2]).fetchall()))\nprint('colunas novas:', [r[1] for r in c.execute('pragma table_info(aluno)') if r[1]=='observacao'], [r[1] for r in c.execute('pragma table_info(venda)') if r[1]=='pagamento_id'])`;
  console.log(execFileSync('python', ['-I', '-c', py, join(dados, 'dados', 'academia.db'), conta], { encoding: 'utf8' }).trim());
} catch (e) { console.log('ERRO', e.message); }
finally {
  try { execFileSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  await espera(1000);
  try { rmSync(base, { recursive: true, force: true }); } catch (e) { console.log('nao apagou a pasta de teste:', e.message); }
  process.exitCode = 0;
}
