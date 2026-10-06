/**
 * Monta desktop/app a partir do resto do repositorio:
 *   api/dist     -> app/servidor   (servidor compilado)
 *   api/drizzle  -> app/drizzle    (migrations)
 *   web/dist     -> app/web        (front compilado)
 * As dependencias ficam em desktop/node_modules, recompiladas para o
 * Electron -- o api/node_modules continua intacto para os testes.
 */
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = join(raiz, 'desktop', 'app');
const rodar = (cmd, cwd) => { console.log(`> ${cmd}  (${cwd.replace(raiz, '.')})`); execSync(cmd, { cwd, stdio: 'inherit' }); };

// testes antes de compilar: pacote so sai com tudo verde
rodar('npm test', join(raiz, 'api'));
rodar('npm test', join(raiz, 'web'));
rodar('npm test', join(raiz, 'desktop'));

rodar('npm run build', join(raiz, 'api'));
rodar('npm run build', join(raiz, 'web'));

rmSync(app, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
cpSync(join(raiz, 'api', 'dist'), join(app, 'servidor'), { recursive: true });
cpSync(join(raiz, 'api', 'drizzle'), join(app, 'drizzle'), { recursive: true });
cpSync(join(raiz, 'web', 'dist'), join(app, 'web'), { recursive: true });

for (const p of ['servidor/index.js', 'drizzle/meta/_journal.json', 'web/index.html']) {
  if (!existsSync(join(app, p))) throw new Error(`faltou ${p}`);
}
console.log('\napp/ montado: servidor + migrations + web');
