import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { aluno, plano, pagamento, usuario, sessao } from '../../src/db/schema.js';

const SENHA = 'senha-do-dono-123';
let banco: ReturnType<typeof criarBancoDeTeste>;
let servicos: ReturnType<typeof criarServicos>;
let servidor: FastifyInstance;
let alunoId: number, planoId: number, donoId: number, recepcaoId: number, senhaHash: string;

beforeAll(async () => { senhaHash = await hashSenha(SENHA); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T12:00:00.000Z'));
  banco = criarBancoDeTeste();
  servicos = criarServicos(banco.db);
  alunoId = banco.db.insert(aluno).values({ nome: 'José da Conceição', telefone: '+5511999990001' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 1000, duracaoMeses: 1 }).returning().get().id;
  for (const papel of ['dono', 'recepcao', 'professor'] as const) {
    const pessoa = banco.db.insert(usuario).values({ nome: papel, email: `${papel}@teste`, papel, senhaHash }).returning().get();
    if (papel === 'dono') donoId = pessoa.id;
    if (papel === 'recepcao') recepcaoId = pessoa.id;
    banco.db.insert(sessao).values({ usuarioId: pessoa.id, token: papel, expiraEm: '2099-01-01T00:00:00.000Z' }).run();
  }
  servidor = construirServidor({ db: banco.db });
  await servidor.ready();
});
afterEach(async () => { await servidor.close(); banco.fechar(); vi.useRealTimers(); });

const consultar = (caminho: string, papel = 'dono') => servidor.inject({ method: 'GET', url: caminho, headers: { authorization: `Bearer ${papel}` } });
const editar = (id: number, campos: Record<string, unknown>, papel = 'dono') => servidor.inject({
  method: 'PUT', url: `/api/pagamentos/${id}`, headers: { authorization: `Bearer ${papel}` }, payload: { senha: SENHA, ...campos },
});
const excluir = (id: number, campos: Record<string, unknown> = {}) => servidor.inject({
  method: 'DELETE', url: `/api/pagamentos/${id}`, headers: { authorization: 'Bearer dono' }, payload: { senha: SENHA, ...campos },
});
const pagar = (campos: Partial<Parameters<typeof servicos.financeiro.registrarPagamento>[0]> = {}) =>
  servicos.financeiro.registrarPagamento({ alunoId, planoId, valorCentavos: 1000, forma: 'pix', dataPagamento: '2026-10-10', ...campos });

describe('histórico: filtros e paginação HTTP', () => {
  it('sem filtro devolve todos os meses, página padrão de 50 e totais completos', async () => {
    banco.db.transaction((tx) => {
      for (let i = 0; i < 51; i++) tx.insert(pagamento).values({ alunoId, valorCentavos: 100, forma: 'pix', dataPagamento: '2026-09-10' }).run();
    });
    const resposta = await consultar('/api/pagamentos/historico');
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(Object.keys(corpo).sort()).toEqual(['itens', 'meses', 'pagina', 'porDia', 'porForma', 'porPagina', 'quantidade', 'totalCentavos', 'totalPaginas']);
    expect(corpo).toMatchObject({ pagina: 1, porPagina: 50, totalPaginas: 2, quantidade: 51, totalCentavos: 5100,
      porForma: [{ forma: 'pix', quantidade: 51, totalCentavos: 5100 }], porDia: [] });
    expect(corpo.itens).toHaveLength(50);
    expect(corpo.itens[0]).toMatchObject({ id: 51, periodos: null, registradoPorNome: null, editado: false });
    expect(corpo.meses).toHaveLength(12);
    expect((await consultar('/api/pagamentos/historico?pagina=2')).json().itens.map((item: { id: number }) => item.id)).toEqual([1]);
    expect((await consultar('/api/pagamentos/historico?pagina=3')).json()).toMatchObject({ itens: [], quantidade: 51, totalCentavos: 5100, totalPaginas: 2, pagina: 3 });
    expect((await consultar('/api/pagamentos/historico?porPagina=200')).json()).toMatchObject({ porPagina: 200, quantidade: 51, totalPaginas: 1 });
  });

  it('combina intervalo inclusivo, nome sem acento, forma e plano antes de paginar', async () => {
    pagar({ dataPagamento: '2026-09-30' });
    const primeiro = pagar({ dataPagamento: '2026-10-01', valorCentavos: 1000 });
    const segundo = pagar({ dataPagamento: '2026-10-19', valorCentavos: 2000 });
    const terceiro = pagar({ dataPagamento: '2026-10-19', valorCentavos: 3000 });
    pagar({ forma: 'dinheiro' });
    const outroPlano = banco.db.insert(plano).values({ nome: 'Trimestral', duracaoMeses: 3, precoCentavos: 3000 }).returning().get();
    pagar({ planoId: outroPlano.id });
    const outra = banco.db.insert(aluno).values({ nome: 'Ana', telefone: '+5511999990002' }).returning().get();
    pagar({ alunoId: outra.id });
    const filtro = `de=2026-10-01&ate=2026-10-19&busca=JOSE&forma=pix&planoId=${planoId}&porPagina=2`;
    const resposta = await consultar(`/api/pagamentos/historico?${filtro}`);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ pagina: 1, porPagina: 2, totalPaginas: 2, quantidade: 3, totalCentavos: 6000,
      porForma: [{ forma: 'pix', quantidade: 3, totalCentavos: 6000 }], porDia: [] });
    expect(resposta.json().itens.map((item: { id: number }) => item.id)).toEqual([terceiro.pagamento.id, segundo.pagamento.id]);
    expect((await consultar(`/api/pagamentos/historico?${filtro}&pagina=2`)).json().itens.map((item: { id: number }) => item.id)).toEqual([primeiro.pagamento.id]);
    const mesmoDia = await consultar(`/api/pagamentos/historico?de=2026-10-19&ate=2026-10-19&forma=pix&planoId=${planoId}&busca=jose`);
    expect(mesmoDia.json()).toMatchObject({ quantidade: 2, totalCentavos: 5000 });
    expect((await consultar('/api/pagamentos/historico?busca=inexistente')).json()).toMatchObject({ itens: [], quantidade: 0, totalCentavos: 0, totalPaginas: 0 });
  });

  it.each([
    'de=2026-10-01', 'ate=2026-10-19', 'de=2026-10-19&ate=2026-10-01', 'de=2026-02-30&ate=2026-10-19',
    'de=2026-10-01&ate=2026-02-30', 'mes=2026-10&de=2026-10-01&ate=2026-10-19',
    'forma=transferencia', 'planoId=0', 'planoId=abc', 'planoId=1.5', 'pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=abc',
    'porPagina=0', 'porPagina=201', 'porPagina=1.5', 'porPagina=abc',
  ])('recusa filtro inválido: %s', async (query) => {
    expect((await consultar(`/api/pagamentos/historico?${query}`)).statusCode).toBe(400);
  });
});

describe('registro de alterações: contrato e autoria', () => {
  it('preserva períodos e autoria do cadastro e grava snapshots exatos na edição e exclusão', async () => {
    const registro = await servidor.inject({ method: 'POST', url: '/api/pagamentos', headers: { authorization: 'Bearer recepcao' },
      payload: { alunoId, planoId, valorCentavos: 2000, forma: 'pix', dataPagamento: '2026-10-10', periodos: 2, usuarioId: donoId } });
    expect(registro.statusCode).toBe(201);
    const pagamentoId = registro.json().pagamento.id;
    expect((await consultar('/api/pagamentos/historico')).json().itens[0])
      .toMatchObject({ periodos: 2, registradoPorUsuarioId: recepcaoId, registradoPorNome: 'recepcao', editado: false });
    const edicao = await editar(pagamentoId, { dataPagamento: '2026-10-11', valorCentavos: 2100, forma: 'dinheiro', observacao: 'Correção' });
    expect(edicao.statusCode).toBe(200);
    expect(edicao.json()).toMatchObject({ dataFimNova: '2026-12-11', pagamento: { periodos: 2, registradoPorNome: 'recepcao', editado: true } });
    const antes = { dataPagamento: '2026-10-10', valorCentavos: 2000, forma: 'pix', planoNome: 'Mensal', periodos: 2, observacao: null };
    const depois = { dataPagamento: '2026-10-11', valorCentavos: 2100, forma: 'dinheiro', planoNome: 'Mensal', periodos: 2, observacao: 'Correção' };
    const primeiro = (await consultar(`/api/pagamentos/alteracoes?pagamentoId=${pagamentoId}`)).json();
    expect(primeiro).toEqual([{ id: expect.any(Number), acao: 'editou', em: expect.any(String), usuarioNome: 'dono',
      alunoNome: 'José da Conceição', pagamentoId, antes, depois }]);
    expect((await excluir(pagamentoId, { usuarioId: recepcaoId })).statusCode).toBe(200);
    const historico = await consultar(`/api/pagamentos/alteracoes?pagamentoId=${pagamentoId}`);
    expect(historico.statusCode).toBe(200);
    expect(historico.json()).toEqual([{ id: expect.any(Number), acao: 'excluiu', em: expect.any(String), usuarioNome: 'dono',
      alunoNome: 'José da Conceição', pagamentoId, antes: depois, depois: null }, primeiro[0]]);
    expect((await consultar('/api/pagamentos/historico')).json().itens).toEqual([]);
  });

  it('filtra pagamento e limita eventos do mais recente ao mais antigo', async () => {
    const primeiro = pagar({ planoId: undefined });
    const segundo = pagar({ planoId: undefined });
    expect((await editar(primeiro.pagamento.id, { valorCentavos: 1100 })).statusCode).toBe(200);
    expect((await editar(segundo.pagamento.id, { valorCentavos: 1200 })).statusCode).toBe(200);
    const ultimas = await consultar('/api/pagamentos/alteracoes?limite=1');
    expect(ultimas.statusCode).toBe(200);
    expect(ultimas.json()).toHaveLength(1);
    expect(ultimas.json()[0]).toMatchObject({ pagamentoId: segundo.pagamento.id, antes: { planoNome: null, periodos: null }, depois: { periodos: null } });
    expect((await consultar(`/api/pagamentos/alteracoes?pagamentoId=${primeiro.pagamento.id}&limite=1`)).json())
      .toMatchObject([{ pagamentoId: primeiro.pagamento.id }]);
    expect((await consultar('/api/pagamentos/alteracoes?pagamentoId=999')).json()).toEqual([]);
  });

  it('aplica limite padrão de 50 e permite consultar até 200 alterações', async () => {
    const registro = pagar({ planoId: undefined });
    for (let i = 0; i < 51; i++) servicos.financeiro.editarPagamento(registro.pagamento.id, { valorCentavos: 1001 + i }, donoId);
    const padrao = await consultar('/api/pagamentos/alteracoes');
    expect(padrao.statusCode).toBe(200);
    expect(padrao.json()).toHaveLength(50);
    expect(padrao.json()[0]).toMatchObject({ depois: { valorCentavos: 1051 } });
    expect(padrao.json().at(-1)).toMatchObject({ depois: { valorCentavos: 1002 } });
    expect((await consultar('/api/pagamentos/alteracoes?limite=200')).json()).toHaveLength(51);
  });

  it.each(['recepcao', 'professor'])('registro de alterações recusa %s', async (papel) => {
    expect((await consultar('/api/pagamentos/alteracoes', papel)).statusCode).toBe(403);
  });

  it('registro de alterações exige sessão', async () => {
    expect((await servidor.inject({ method: 'GET', url: '/api/pagamentos/alteracoes' })).statusCode).toBe(401);
  });

  it.each(['pagamentoId=0', 'pagamentoId=1.5', 'pagamentoId=abc', 'limite=0', 'limite=201', 'limite=1.5', 'limite=abc'])
    ('recusa filtro de alterações inválido: %s', async (query) => {
      expect((await consultar(`/api/pagamentos/alteracoes?${query}`)).statusCode).toBe(400);
    });

  it('senha incorreta e tentativa de forjar editor não geram evento', async () => {
    const registro = pagar();
    expect((await editar(registro.pagamento.id, { senha: 'errada', valorCentavos: 100 })).statusCode).toBe(400);
    expect((await editar(registro.pagamento.id, { usuarioId: recepcaoId, valorCentavos: 100 })).statusCode).toBe(400);
    expect((await excluir(registro.pagamento.id, { senha: 'errada' })).statusCode).toBe(400);
    expect((await consultar('/api/pagamentos/alteracoes')).json()).toEqual([]);
    expect((await consultar('/api/pagamentos/historico')).json().itens[0]).toMatchObject({ valorCentavos: 1000, editado: false });
  });
});

describe('data futura no contrato HTTP', () => {
  it.each(['POST', 'PUT'] as const)('%s recusa amanhã com mensagem exata e sem gravar', async (method) => {
    const registro = pagar();
    const antes = banco.db.select().from(pagamento).all();
    const resposta = await servidor.inject({ method, url: method === 'POST' ? '/api/pagamentos' : `/api/pagamentos/${registro.pagamento.id}`,
      headers: { authorization: 'Bearer dono' }, payload: method === 'POST'
        ? { alunoId, planoId, valorCentavos: 1000, forma: 'pix', dataPagamento: '2026-10-20' }
        : { senha: SENHA, dataPagamento: '2026-10-20' } });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: 'A data do pagamento não pode ser depois de hoje.' });
    expect(banco.db.select().from(pagamento).all()).toEqual(antes);
    expect((await consultar('/api/pagamentos/alteracoes')).json()).toEqual([]);
  });

  it('aceita pagamento de hoje e mantém diária marcada para uma data futura', async () => {
    const diaria = banco.db.insert(plano).values({ nome: 'Diária', duracaoMeses: 0, duracaoDias: 1, precoCentavos: 2500 }).returning().get();
    const resposta = await servidor.inject({ method: 'POST', url: '/api/pagamentos', headers: { authorization: 'Bearer recepcao' },
      payload: { alunoId, planoId: diaria.id, valorCentavos: 2500, forma: 'pix', dataPagamento: '2026-10-19', dataInicioEscolhida: '2026-10-25' } });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toMatchObject({ pagamento: { dataPagamento: '2026-10-19', periodos: 1 }, matricula: { dataInicio: '2026-10-25', dataFim: '2026-10-25' } });
  });
});

describe('histórico: números consolidados só para o dono', () => {
  // regra antiga do sistema: a recepção recebe pagamento e vê a lista, mas o
  // total do caixa o servidor nem envia para ela
  it('recepção recebe a lista e a paginação, sem total, formas, dias e meses', async () => {
    pagar();
    const resposta = await consultar('/api/pagamentos/historico?mes=2026-10', 'recepcao');
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.itens).toHaveLength(1);
    expect(corpo).toMatchObject({ quantidade: 1, pagina: 1, totalPaginas: 1 });
    for (const campo of ['totalCentavos', 'porForma', 'porDia', 'meses']) expect(corpo).not.toHaveProperty(campo);
  });

  it('dono continua recebendo os totais', async () => {
    pagar();
    const corpo = (await consultar('/api/pagamentos/historico?mes=2026-10')).json();
    expect(corpo).toMatchObject({ totalCentavos: 1000, quantidade: 1 });
    expect(corpo.meses).toHaveLength(12);
  });
});
