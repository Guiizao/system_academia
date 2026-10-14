import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { aluno, aula, inscricaoAula, matricula, pagamento, plano, sessao, usuario } from '../../src/db/schema.js';

let banco: ReturnType<typeof criarBancoDeTeste>;
let servidor: ReturnType<typeof construirServidor>;
let servicos: ReturnType<typeof criarServicos>;
let alunoId: number, planoId: number;

beforeEach(() => {
  banco = criarBancoDeTeste();
  const pessoas = banco.db.insert(usuario).values([
    { nome: 'Dono de teste', email: 'dono@teste.local', papel: 'dono' },
    { nome: 'Professor de teste', email: 'professor@teste.local', papel: 'professor' },
  ]).returning().all();
  banco.db.insert(sessao).values(pessoas.map((pessoa) => ({
    usuarioId: pessoa.id, token: pessoa.papel, expiraEm: '2099-01-01T00:00:00.000Z',
  }))).run();
  alunoId = banco.db.insert(aluno).values({ nome: 'Aluno de teste', telefone: '+5511999990001' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1 }).returning().get().id;
  servidor = construirServidor({ db: banco.db });
  servicos = criarServicos(banco.db);
});
afterEach(async () => { await servidor.close(); banco.fechar(); });

const cadastrar = (campos = {}, papel = 'dono') => servidor.inject({
  method: 'POST', url: '/api/alunos', headers: { authorization: `Bearer ${papel}` },
  payload: { nome: 'Nova aluna', telefone: '11999990002', consentimentoLgpd: true, planoId, formaPagamento: 'pix', ...campos },
});
const pagar = (campos = {}) => servidor.inject({
  method: 'POST', url: '/api/pagamentos', headers: { authorization: 'Bearer dono' },
  payload: { alunoId, planoId, valorCentavos: 9000, forma: 'pix', dataPagamento: '2026-10-14', ...campos },
});

describe('revisão do cadastro e das permissões', () => {
  it('professor não registra pagamento pela matrícula inicial', async () => {
    const resposta = await cadastrar({}, 'professor');
    expect(resposta.statusCode).toBe(403);
    expect(banco.db.select().from(aluno).all()).toHaveLength(1);
    expect(banco.db.select().from(pagamento).all()).toHaveLength(0);
  });

  it('professor continua podendo cadastrar sem pagamento', async () => {
    expect((await cadastrar({ planoId: undefined, formaPagamento: undefined }, 'professor')).statusCode).toBe(201);
  });

  it('não deixa aluno cadastrado se a gravação do pagamento falhar', async () => {
    banco.sqlite.exec("CREATE TRIGGER falhar_pagamento BEFORE INSERT ON pagamento BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
    expect((await cadastrar()).statusCode).toBe(500);
    expect(banco.db.select().from(aluno).all()).toHaveLength(1);
    expect(banco.db.select().from(matricula).all()).toHaveLength(0);
  });

  it('plano inexistente não vira cadastro bem-sucedido sem matrícula', async () => {
    expect((await cadastrar({ planoId: 99999 })).statusCode).toBe(404);
    expect(banco.db.select().from(aluno).all()).toHaveLength(1);
  });

  it('não vende plano desativado por chamada direta', async () => {
    banco.db.update(plano).set({ ativo: false }).run();
    expect((await pagar()).statusCode).toBe(400);
    expect(banco.db.select().from(pagamento).all()).toHaveLength(0);
    expect(banco.db.select().from(matricula).all()).toHaveLength(0);
  });

  it('logout revoga a sessão enviada por Bearer', async () => {
    const headers = { authorization: 'Bearer dono' };
    expect((await servidor.inject({ method: 'POST', url: '/api/auth/logout', headers })).statusCode).toBe(200);
    expect((await servidor.inject({ method: 'GET', url: '/api/auth/eu', headers })).statusCode).toBe(401);
  });
});

describe('revisão das datas e aulas', () => {
  it('recusa data inexistente na agenda e na inscrição', async () => {
    const headers = { authorization: 'Bearer dono' };
    const registro = banco.db.insert(aula).values({ nome: 'Aula de teste', diaSemana: 2, hora: '10:00', vagas: 5 }).returning().get();
    expect((await servidor.inject({ method: 'GET', url: '/api/aulas?data=2026-02-31', headers })).statusCode).toBe(400);
    expect((await servidor.inject({
      method: 'POST', url: `/api/aulas/${registro.id}/inscricoes`, headers, payload: { alunoId, data: '2026-02-31' },
    })).statusCode).toBe(400);
    expect(banco.db.select().from(inscricaoAula).all()).toHaveLength(0);
  });

  it.each([
    { dataPagamento: '2026-02-31' },
    { dataFimManual: '2026-11-31' },
    { dataInicioEscolhida: '2026-13-01' },
  ])('recusa data inexistente no pagamento e na prévia: %j', async (campos) => {
    expect((await pagar(campos)).statusCode).toBe(400);
    const parametros = new URLSearchParams({ alunoId: String(alunoId), planoId: String(planoId) });
    for (const [campo, valor] of Object.entries(campos)) parametros.set(campo, valor);
    expect((await servidor.inject({
      method: 'GET', url: `/api/pagamentos/previa?${parametros}`, headers: { authorization: 'Bearer dono' },
    })).statusCode).toBe(400);
    expect(banco.db.select().from(pagamento).all()).toHaveLength(0);
  });

  it('vencimento anterior ao início é erro de entrada com mensagem útil', async () => {
    const resposta = await pagar({ dataFimManual: '2026-10-01' });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toContain('antes do início');
    expect(banco.db.select().from(pagamento).all()).toHaveLength(0);
  });

  it('aula desativada não recebe inscrição', () => {
    const registro = banco.db.insert(aula).values({ nome: 'Aula de teste', diaSemana: 3, hora: '10:00', vagas: 5, ativo: false }).returning().get();
    expect(() => servicos.aulas.inscrever(registro.id, alunoId, '2026-10-14')).toThrow('desativada');
    expect(banco.db.select().from(inscricaoAula).all()).toHaveLength(0);
  });

  it('recusa horário impossível ao criar e editar aula', async () => {
    const headers = { authorization: 'Bearer dono' };
    const dados = { nome: 'Aula de teste', diaSemana: 3, hora: '99:99', vagas: 5 };
    expect((await servidor.inject({ method: 'POST', url: '/api/aulas', headers, payload: dados })).statusCode).toBe(400);
    const registro = banco.db.insert(aula).values({ ...dados, hora: '10:00' }).returning().get();
    expect((await servidor.inject({ method: 'PUT', url: `/api/aulas/${registro.id}`, headers, payload: { hora: '24:00' } })).statusCode).toBe(400);
    expect(banco.db.select().from(aula).where(eq(aula.id, registro.id)).get()!.hora).toBe('10:00');
  });
});
