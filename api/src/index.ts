import 'dotenv/config';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { abrirBanco } from './db/client.js';
import { migrarComBackup } from './db/migrate.js';
import { garantirCatalogo } from './db/catalogo.js';
import { construirServidor } from './servidor.js';

const aqui = dirname(fileURLToPath(import.meta.url));

/** IPs da rede local: e por eles que celular e outros PCs acessam o sistema. */
export function ipsLocais(): string[] {
  return Object.values(networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

export async function iniciar(opts: { porta?: number; caminhoBanco?: string; pastaWeb?: string; logger?: boolean } = {}) {
  const porta = opts.porta ?? Number(process.env.PORT ?? 3000);
  const caminhoBanco = resolve(opts.caminhoBanco ?? process.env.DB_PATH ?? './dados/academia.db');
  // @fastify/static exige caminho absoluto: resolve() cobre o relativo vindo do .env
  const pastaWeb = resolve(opts.pastaWeb ?? process.env.WEB_DIST ?? join(aqui, '..', '..', 'web', 'dist'));

  const { db, sqlite } = abrirBanco(caminhoBanco);
  migrarComBackup(db, sqlite, caminhoBanco);
  // cobre bancos criados antes da biblioteca entrar na instalacao real
  garantirCatalogo(db);

  const app = construirServidor({ db, pastaWeb, logger: opts.logger ?? true });
  // 0.0.0.0: aceita conexoes da rede local, nao so do proprio PC
  await app.listen({ port: porta, host: '0.0.0.0' });

  return {
    app, porta, caminhoBanco, db, sqlite,
    urls: [`http://localhost:${porta}`, ...ipsLocais().map((ip) => `http://${ip}:${porta}`)],
    parar: async () => { await app.close(); sqlite.close(); },
  };
}

// executado direto (npm run dev / node dist/index.js)
const direto = process.argv[1] && resolve(process.argv[1]).replace(/\.ts$/, '.js') === fileURLToPath(import.meta.url).replace(/\.ts$/, '.js');
if (direto) {
  iniciar().then(({ urls }) => {
    console.log('\nDARK FISIC no ar:');
    urls.forEach((u) => console.log('  ' + u));
  }).catch((e) => { console.error(e); process.exit(1); });
}
