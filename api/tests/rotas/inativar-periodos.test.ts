import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { aluno, cobranca, matricula, pagamento, plano, sessao, usuario } from '../../src/db/schema.js';

const SENHA = 'senha-do-dono-123';
let banco: ReturnType<typeof criarBancoDeTeste>;
let servicos: ReturnType<typeof criarServicos>;
let servidor: FastifyInstance;
let alunoId: number, planoId: number, senhaHash: string;

beforeAll(async () => { senhaHash = await hashSenha(SENHA); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
  banco = criarBancoDeTeste();
  servicos = criarServicos(banco.db);
  alunoId = banco.db.insert(aluno).values({ nome: 'José', telefone: '+5511999990001' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 1000, duracaoMeses: 1 }).returning().get().id;
  for (const papel of ['dono', 'recepcao', 'professor'] as const) {
    const pessoa = banco.db.insert(usuario).values({ nome: papel, email: `${papel}@teste`, papel, senhaHash }).returning().get();
    banco.db.insert(sessao).values({ usuarioId: pessoa.id, token: papel, expiraEm: '2099-01-01T00:00:00.000Z' }).run();
  }
  servidor = construirServidor({ db: banco.db });
  await servidor.ready();
});
afterEach(async () => { await servidor.close(); banco.fechar(); vi.useRealTimers(); });

const consultar = (caminho: string, papel = 'dono') => servidor.inject({
  method: 'GET', url: caminho, headers: { authorization: `Bearer ${papel}` },
});
const inativar = (papel = 'dono', id: number | string = alunoId) => servidor.inject({
  method: 'POST', url: `/api/alunos/${id}/inativar`, headers: { authorization: `Bearer ${papel}` },
});
const pagar = (campos: Partial<Parameters<typeof servicos.financeiro.registrarPagamento>[0]> = {}) =>
  servicos.financeiro.registrarPagamento({ alunoId, planoId, valorCentavos: 1000, forma: 'pix', dataPagamento: '2026-09-10', ...campos });

describe('inativação do aluno vencido', () => {
  it.each(['dono', 'recepcao'])('%s inativa sem excluir o aluno, cancela abertas e atualiza os filtros', async (papel) => {
    const registro = pagar();
    servicos.financeiro.gerarCobrancasDevidas();
    const automatica = banco.db.select().from(cobranca).get()!;
    const avulsa = banco.db.insert(cobranca).values({ alunoId, competencia: '2026-09', valorCentavos: 200, vencimento: '2026-09-10' }).returning().get();
    const paga = banco.db.insert(cobranca).values({ alunoId, competencia: '2026-08', valorCentavos: 200, vencimento: '2026-08-10', status: 'paga' }).returning().get();
    const cancelada = banco.db.insert(cobranca).values({ alunoId, competencia: '2026-07', valorCentavos: 200, vencimento: '2026-07-10', status: 'cancelada' }).returning().get();
    const outro = banco.db.insert(aluno).values({ nome: 'Ana', telefone: '+5511999990002' }).returning().get();
    const deOutro = banco.db.insert(cobranca).values({ alunoId: outro.id, competencia: '2026-10', valorCentavos: 300, vencimento: '2026-10-10' }).returning().get();
    const pagamentosAntes = banco.db.select().from(pagamento).all();
    expect((await consultar('/api/alunos?status=vencido')).json()).toMatchObject([{ id: alunoId }]);

    const resposta = await inativar(papel);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual(servicos.alunos.obter(alunoId));
    expect(resposta.json()).toMatchObject({ id: alunoId, ativo: true, status: 'inativo', matricula: null });
    expect(banco.db.select().from(matricula).where(eq(matricula.id, registro.matricula!.id)).get())
      .toMatchObject({ status: 'encerrada', dataInicio: '2026-09-10', dataFim: '2026-10-10' });
    expect(banco.db.select().from(cobranca).all()).toEqual([
      { ...automatica, status: 'cancelada' },
      { ...avulsa, status: 'cancelada' }, paga, cancelada, deOutro,
    ]);
    expect(banco.db.select().from(pagamento).all()).toEqual(pagamentosAntes);
    expect((await consultar('/api/alunos?status=vencido')).json()).toEqual([]);
    expect((await consultar('/api/alunos?status=inativo')).json().map((item: { id: number }) => item.id)).toContain(alunoId);
    expect(servicos.financeiro.cobrancasAbertas().map((item) => item.id)).toEqual([deOutro.id]);
    expect(servicos.financeiro.cobrancasAbertas('2026-12-20').map((item) => item.id)).toEqual([deOutro.id]);
    expect(banco.db.select().from(cobranca).all()).toHaveLength(5);
  });

  it.each([
    ['ativo', '2026-10-10'], ['vencendo', '2026-09-23'], ['inativo', null],
  ] as const)('recusa aluno %s com mensagem exata e sem alterar registros', async (status, dataPagamento) => {
    if (dataPagamento) pagar({ dataPagamento });
    servicos.financeiro.gerarCobrancasDevidas();
    const matriculasAntes = banco.db.select().from(matricula).all();
    const cobrancasAntes = banco.db.select().from(cobranca).all();
    expect(servicos.alunos.obter(alunoId)?.status).toBe(status);
    const resposta = await inativar();
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: 'Só aluno vencido pode ser marcado como inativo.' });
    expect(banco.db.select().from(matricula).all()).toEqual(matriculasAntes);
    expect(banco.db.select().from(cobranca).all()).toEqual(cobrancasAntes);
  });

  it('recusa uma segunda inativação e preserva o período encerrado', async () => {
    pagar();
    expect((await inativar()).statusCode).toBe(200);
    const antes = banco.db.select().from(matricula).all();
    const resposta = await inativar();
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: 'Só aluno vencido pode ser marcado como inativo.' });
    expect(banco.db.select().from(matricula).all()).toEqual(antes);
  });

  it('recusa professor com mensagem exata e preserva matrícula e cobrança', async () => {
    pagar();
    const abertas = servicos.financeiro.cobrancasAbertas();
    const resposta = await inativar('professor');
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ erro: 'Professor não marca aluno como inativo' });
    expect(servicos.alunos.obter(alunoId)?.status).toBe('vencido');
    expect(servicos.financeiro.cobrancasAbertas()).toEqual(abertas);
  });

  it('retorna 404 para aluno inexistente', async () => {
    const resposta = await inativar('dono', 999);
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Aluno não encontrado' });
  });

  it('desfaz a inativação inteira se o cancelamento de cobrança falhar', async () => {
    pagar();
    servicos.financeiro.gerarCobrancasDevidas();
    const matriculasAntes = banco.db.select().from(matricula).all();
    const cobrancasAntes = banco.db.select().from(cobranca).all();
    banco.sqlite.exec(`CREATE TRIGGER impedir_cancelamento BEFORE UPDATE OF status ON cobranca
      WHEN NEW.status = 'cancelada' BEGIN SELECT RAISE(ABORT, 'falha de teste'); END`);
    expect((await inativar()).statusCode).toBe(500);
    expect(banco.db.select().from(matricula).all()).toEqual(matriculasAntes);
    expect(banco.db.select().from(cobranca).all()).toEqual(cobrancasAntes);
    expect(servicos.alunos.obter(alunoId)?.status).toBe('vencido');
  });

  it('pagamento de volta inicia na data paga; excluí-lo restaura o vencido sem reabrir a cobrança cancelada', async () => {
    const anterior = pagar();
    servicos.financeiro.gerarCobrancasDevidas();
    expect((await inativar()).statusCode).toBe(200);
    const volta = await servidor.inject({ method: 'POST', url: '/api/pagamentos', headers: { authorization: 'Bearer recepcao' },
      payload: { alunoId, planoId, valorCentavos: 1000, forma: 'pix', dataPagamento: '2026-10-20' } });
    expect(volta.statusCode).toBe(201);
    expect(volta.json()).toMatchObject({ matricula: { dataInicio: '2026-10-20', dataFim: '2026-11-20', status: 'ativa' } });
    expect((await consultar(`/api/alunos/${alunoId}`)).json()).toMatchObject({ status: 'ativo' });
    expect((await consultar(`/api/alunos/${alunoId}/periodos`)).json()).toEqual([
      { dataInicio: '2026-09-10', dataFim: '2026-10-10' },
      { dataInicio: '2026-10-20', dataFim: '2026-11-20' },
    ]);

    const exclusao = await servidor.inject({ method: 'DELETE', url: `/api/pagamentos/${volta.json().pagamento.id}`,
      headers: { authorization: 'Bearer dono' }, payload: { senha: SENHA } });
    expect(exclusao.statusCode).toBe(200);
    expect(exclusao.json()).toMatchObject({ ok: true, alunoId, dataFimNova: '2026-10-10' });
    expect((await consultar(`/api/alunos/${alunoId}`)).json()).toMatchObject({ status: 'vencido', matricula: { id: anterior.matricula!.id, status: 'ativa' } });
    expect((await consultar(`/api/alunos/${alunoId}/periodos`)).json()).toEqual([{ dataInicio: '2026-09-10', dataFim: '2026-10-10' }]);
    expect(banco.db.select().from(pagamento).all()).toEqual([anterior.pagamento]);
    expect(banco.db.select().from(cobranca).all()).toMatchObject([{ status: 'cancelada' }]);
    expect(servicos.financeiro.cobrancasAbertas()).toEqual([]);
  });
});

describe('períodos pagos do aluno', () => {
  it.each(['dono', 'recepcao'])('%s recebe somente datas, em ordem, de matrículas ativas e encerradas do aluno', async (papel) => {
    const primeiro = pagar({ dataPagamento: '2026-07-10', periodos: 3, valorCentavos: 3000 });
    const renovacao = pagar({ dataPagamento: '2026-10-15' });
    expect(primeiro.matricula).toMatchObject({ dataInicio: '2026-07-10', dataFim: '2026-10-10' });
    expect(renovacao.matricula).toMatchObject({ dataInicio: '2026-10-15', dataFim: '2026-11-15' });
    // Inserido depois para a ordenação por data não passar por acaso pela ordem dos IDs.
    banco.db.insert(matricula).values({ alunoId, planoId, dataInicio: '2026-05-10', dataFim: '2026-06-10', diaAncora: 10, valorCentavos: 1000, status: 'encerrada' }).run();
    banco.db.insert(matricula).values({ alunoId, planoId, dataInicio: '2026-06-10', dataFim: '2026-07-10', diaAncora: 10, valorCentavos: 1000, status: 'cancelada' }).run();
    const outro = banco.db.insert(aluno).values({ nome: 'Ana', telefone: '+5511999990002' }).returning().get();
    pagar({ alunoId: outro.id, dataPagamento: '2026-10-01' });
    const resposta = await consultar(`/api/alunos/${alunoId}/periodos`, papel);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([
      { dataInicio: '2026-05-10', dataFim: '2026-06-10' },
      { dataInicio: '2026-07-10', dataFim: '2026-10-10' },
      { dataInicio: '2026-10-15', dataFim: '2026-11-15' },
    ]);
  });

  it('retorna lista vazia para aluno sem períodos', async () => {
    const resposta = await consultar(`/api/alunos/${alunoId}/periodos`);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual([]);
  });

  it('recusa professor', async () => {
    pagar();
    expect((await consultar(`/api/alunos/${alunoId}/periodos`, 'professor')).statusCode).toBe(403);
  });
});

describe.each([
  ['POST', 'inativar'], ['GET', 'periodos'],
] as const)('%s /api/alunos/:id/%s', (method, caminho) => {
  it('exige sessão', async () => {
    pagar();
    const resposta = await servidor.inject({ method, url: `/api/alunos/${alunoId}/${caminho}` });
    expect(resposta.statusCode).toBe(401);
    expect(servicos.alunos.obter(alunoId)?.status).toBe('vencido');
  });

  it.each(['0', '-1', '1.5', 'abc'])('recusa ID inválido: %s', async (id) => {
    const resposta = await servidor.inject({ method, url: `/api/alunos/${id}/${caminho}`, headers: { authorization: 'Bearer dono' } });
    expect(resposta.statusCode).toBe(400);
  });
});
