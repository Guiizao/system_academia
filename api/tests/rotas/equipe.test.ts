import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { usuario, aluno, academia, cobranca, fichaTreino } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let app: FastifyInstance;
const ck: Record<string, string> = {};
let alunoId: number;

const entrar = async (email: string, senha = 'senha-teste-1') => {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha } });
  expect(r.statusCode).toBe(200);
  return `df_sessao=${r.cookies.find((c) => c.name === 'df_sessao')!.value}`;
};
const como = (q: string, method: any, url: string, payload?: any) =>
  app.inject({ method, url, payload, headers: { cookie: ck[q] } });

beforeAll(async () => {
  t = criarBancoDeTeste();
  const h = await hashSenha('senha-teste-1');
  t.db.insert(academia).values({ nome: 'DARK FISIC' }).run();
  t.db.insert(usuario).values([
    { nome: 'Joao', email: 'dono@df', papel: 'dono', senhaHash: h },
    { nome: 'Bruna', email: 'rec@df', papel: 'recepcao', senhaHash: h },
  ]).run();
  alunoId = t.db.insert(aluno).values({ nome: 'Rafael', telefone: '+5511980001111' }).returning().get().id;
  t.db.insert(cobranca).values({ alunoId, competencia: '2020-01', valorCentavos: 8900, vencimento: '2020-01-10' }).run();
  t.db.insert(fichaTreino).values({ alunoId, objetivo: 'hipertrofia', nivel: 'iniciante', diasPorSemana: 3 }).run();
  app = construirServidor({ db: t.db as any });
  await app.ready();
  ck.dono = await entrar('dono@df');
  ck.rec = await entrar('rec@df');
});
afterAll(async () => { await app.close(); t.fechar(); });

describe('equipe', () => {
  it('recepcao nao ve nem cria usuarios', async () => {
    expect((await como('rec', 'GET', '/api/usuarios')).statusCode).toBe(403);
    expect((await como('rec', 'POST', '/api/usuarios', { nome: 'X', email: 'x@df', papel: 'dono', senhaInicial: 'senha-longa-12' })).statusCode).toBe(403);
  });
  it('dono cadastra professor com CREF e ele entra', async () => {
    const r = await como('dono', 'POST', '/api/usuarios', {
      nome: 'Pedro', email: 'prof@df.com', papel: 'professor', senhaInicial: 'senha-prof-123', cref: '123456-G/SP',
    });
    expect(r.statusCode).toBe(201);
    ck.prof = await entrar('prof@df.com', 'senha-prof-123');
    expect((await como('prof', 'GET', '/api/auth/eu')).json().usuario.cref).toBe('123456-G/SP');
  });
  it('qualquer um troca a propria senha', async () => {
    const r = await como('rec', 'POST', '/api/auth/senha', { senhaAtual: 'senha-teste-1', novaSenha: 'bruna-nova-senha-1' });
    expect(r.statusCode).toBe(200);
    await entrar('rec@df', 'bruna-nova-senha-1');
  });
});

describe('aluno', () => {
  it('edicao normaliza telefone', async () => {
    const r = await como('rec', 'PUT', `/api/alunos/${alunoId}`, { telefone: '(11) 9 7777-0000', restricoes: ['joelho'] });
    expect(r.json().telefone).toBe('+5511977770000');
    expect(r.json().restricoes).toEqual(['joelho']);
  });
  it('professor NAO desativa aluno: 403, nao 500', async () => {
    const r = await como('prof', 'PUT', `/api/alunos/${alunoId}`, { ativo: false });
    expect(r.statusCode).toBe(403);
  });
});

describe('avisos por papel', () => {
  it('recepcao ve cobranca vencida e ficha parada (pode liberar)', async () => {
    const tipos = (await como('rec', 'GET', '/api/avisos')).json().map((a: any) => a.tipo);
    expect(tipos).toContain('cobranca');
    expect(tipos).toContain('ficha');
  });
  it('professor ve ficha parada, nao ve dinheiro', async () => {
    const tipos = (await como('prof', 'GET', '/api/avisos')).json().map((a: any) => a.tipo);
    expect(tipos).toContain('ficha');
    expect(tipos).not.toContain('cobranca');
    expect(tipos).not.toContain('vencendo');
  });
});
