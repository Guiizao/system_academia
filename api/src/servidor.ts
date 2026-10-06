import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { registrarTratadorDeErros } from './plugins/erros.js';
import { registrarAutenticacao } from './plugins/autenticacao.js';
import { criarServicoAuth } from './servicos/auth.js';
import { criarServicoAlunos } from './servicos/alunos.js';
import { criarServicoCheckins } from './servicos/checkins.js';
import { criarServicoFinanceiro } from './servicos/financeiro.js';
import { criarServicoAulas } from './servicos/aulas.js';
import { criarServicoFichas, iaHabilitada } from './servicos/fichas.js';
import { criarServicoDashboard } from './servicos/dashboard.js';
import { criarServicoMatriculas } from './servicos/matriculas.js';
import { rotasAuth } from './rotas/auth.js';
import { rotasAlunos } from './rotas/alunos.js';
import { rotasFinanceiro } from './rotas/financeiro.js';
import { rotasOperacao } from './rotas/operacao.js';
import { rotasEquipe } from './rotas/equipe.js';
import { criarServicoUsuarios } from './servicos/usuarios.js';
import { criarServicoAvisos } from './servicos/avisos.js';
import { criarServicoRelatorios } from './servicos/relatorios.js';
import { criarServicoAcademia } from './servicos/academia.js';
import { criarServicoPlanos } from './servicos/planos.js';

type Db = BetterSQLite3Database<any>;

export function criarServicos(db: Db) {
  return {
    db,
    auth: criarServicoAuth(db),
    alunos: criarServicoAlunos(db),
    checkins: criarServicoCheckins(db),
    financeiro: criarServicoFinanceiro(db),
    matriculas: criarServicoMatriculas(db),
    aulas: criarServicoAulas(db),
    fichas: criarServicoFichas(db),
    dashboard: criarServicoDashboard(db),
    usuarios: criarServicoUsuarios(db),
    avisos: criarServicoAvisos(db),
    relatorios: criarServicoRelatorios(db),
    academia: criarServicoAcademia(db),
    planos: criarServicoPlanos(db),
  };
}
export type Servicos = ReturnType<typeof criarServicos>;

export interface OpcoesServidor {
  db?: Db;
  /** em quem confiar para ler X-Forwarded-*; padrao: so o loopback */
  trustProxy?: boolean | string | string[];
  /** pasta do frontend compilado (web/dist); servido na raiz */
  pastaWeb?: string;
  logger?: boolean;
}

export function construirServidor(opts: OpcoesServidor = {}): FastifyInstance {
  // Só o loopback é proxy de confiança: o túnel Cloudflare entrega em 127.0.0.1.
  // Com `true`, qualquer um na Wi-Fi forjaria X-Forwarded-For e passaria por
  // outro IP -- o limite de tentativas por IP não valeria nada.
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: opts.trustProxy ?? 'loopback' });
  const iniciadoEm = new Date().toISOString();

  app.register(cookie);
  registrarTratadorDeErros(app);

  app.get('/status', async () => ({
    ok: true,
    // o app de PC informa a versao dele; npm_package_version so existe rodando por "npm run"
    versao: process.env.DF_VERSAO ?? process.env.npm_package_version ?? 'dev',
    iniciadoEm,
    iaHabilitada: iaHabilitada(),
    banco: opts.db ? 'conectado' : 'ausente',
  }));

  if (opts.db) {
    const s = criarServicos(opts.db);
    registrarAutenticacao(app, s.auth);
    rotasAuth(app, s);
    rotasAlunos(app, s);
    rotasFinanceiro(app, s);
    rotasOperacao(app, s);
    rotasEquipe(app, s);
  }

  if (opts.pastaWeb && existsSync(opts.pastaWeb)) {
    app.register(fastifyStatic, { root: opts.pastaWeb, prefix: '/' });
    // SPA: qualquer rota que nao seja /api cai no index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.status(404).send({ erro: 'Rota não encontrada' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}
