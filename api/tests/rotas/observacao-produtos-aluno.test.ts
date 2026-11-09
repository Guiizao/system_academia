import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync, readdirSync } from 'node:fs';
import { criarBancoDeTeste } from '../helpers/db.js';
import { abrirBanco } from '../../src/db/client.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { aluno, plano, produto, venda, pagamento, matricula, cobranca, pagamentoAlteracao, usuario, sessao } from '../../src/db/schema.js';

const senha = 'senha-do-dono-123';
let banco: ReturnType<typeof criarBancoDeTeste>, servidor: FastifyInstance;
let servicos: ReturnType<typeof criarServicos>;
let alunoId: number, planoId: number, produtoId: number, donoId: number, senhaHash: string;
beforeAll(async () => { senhaHash = await hashSenha(senha); });
beforeEach(async () => {
  banco = criarBancoDeTeste();
  servicos = criarServicos(banco.db);
  alunoId = banco.db.insert(aluno).values({ nome: 'Adrian', telefone: '11999990000' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 1000, duracaoMeses: 1 }).returning().get().id;
  produtoId = servicos.produtos.criar({ nome: 'Creatina', estoque: 200, precoCentavos: 2500 }).id;
  for (const papel of ['dono', 'recepcao', 'professor'] as const) {
    const u = banco.db.insert(usuario).values({ nome: papel, email: `${papel}@teste`, papel, senhaHash }).returning().get();
    if (papel === 'dono') donoId = u.id;
    banco.db.insert(sessao).values({ usuarioId: u.id, token: papel, expiraEm: '2099-01-01T00:00:00.000Z' }).run();
  }
  servidor = construirServidor({ db: banco.db });
  await servidor.ready();
});
afterEach(async () => { await servidor.close(); banco.fechar(); });
const pedir = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: any, papel = 'dono') =>
  servidor.inject({ method, url, payload, headers: { authorization: `Bearer ${papel}` } });
const vender = (campos = {}) => servicos.produtos.registrarVenda({ produtoId, alunoId, quantidade: 1, situacao: 'fiado', registradoPorUsuarioId: donoId, ...campos });
const pagar = (campos = {}) => pedir('POST', '/api/pagamentos', { alunoId, planoId, valorCentavos: 1000, forma: 'pix', dataPagamento: '2026-10-10', ...campos }, 'recepcao');
const estado = () => [pagamento, matricula, cobranca, venda, produto, pagamentoAlteracao].map((t) => banco.db.select().from(t).all());

it('observação: trim, limite, preservação quando omitida e vazio como null em listar/obter', async () => {
  for (const texto of ['  Anotar retorno  ', 'x'.repeat(500), '   ', '']) {
    const r = await pedir('PUT', `/api/alunos/${alunoId}`, { observacao: texto });
    expect(r.statusCode).toBe(200);
    expect(r.json().observacao).toBe(texto.trim() || null);
    expect((await pedir('GET', `/api/alunos/${alunoId}`)).json().observacao).toBe(texto.trim() || null);
    expect((await pedir('GET', '/api/alunos')).json()[0].observacao).toBe(texto.trim() || null);
    expect((await pedir('PUT', `/api/alunos/${alunoId}`, { nome: 'Adrian' })).json().observacao).toBe(texto.trim() || null);
  }
});
it.each(['x'.repeat(501), null, 12])('recusa observação inválida (%s)', async (observacao) => {
  expect((await pedir('PUT', `/api/alunos/${alunoId}`, { observacao })).statusCode).toBe(400);
  expect(servicos.alunos.obter(alunoId)?.observacao).toBeNull();
});
it('lista todas as vendas do aluno em ordem, com o mesmo formato da lista geral', async () => {
  const primeira = vender();
  for (let i = 0; i < 100; i++) vender({ situacao: 'paga', forma: 'dinheiro' });
  vender({ alunoId: null, clienteNome: 'Avulso' });
  for (const papel of ['dono', 'recepcao']) {
    const r = await pedir('GET', `/api/alunos/${alunoId}/vendas`, undefined, papel);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toHaveLength(101);
    expect(r.json().at(-1)).toMatchObject({ id: primeira.id, pagamentoId: null, alunoNome: 'Adrian', produtoNome: 'Creatina' });
    expect(r.json()[0]).toEqual(servicos.produtos.listarVendas()[1]);
  }
  const outro = banco.db.insert(aluno).values({ nome: 'Outro', telefone: '11999990001' }).returning().get();
  expect((await pedir('GET', `/api/alunos/${outro.id}/vendas`)).json()).toEqual([]);
  expect((await pedir('GET', '/api/alunos/9999/vendas')).statusCode).toBe(404);
  expect((await pedir('GET', `/api/alunos/${alunoId}/vendas`, undefined, 'professor')).statusCode).toBe(403);
  expect((await servidor.inject({ method: 'GET', url: `/api/alunos/${alunoId}/vendas` })).statusCode).toBe(401);
});
it('Adrian: paga produtos com mensalidade, edita forma/data com renovação e exclui voltando a fiado', async () => {
  const v = vender();
  const separada = vender({ situacao: 'paga', forma: 'dinheiro' });
  const r = await pagar({ vendasIds: [v.id] });
  expect(r.statusCode).toBe(201);
  const id = r.json().pagamento.id;
  expect(r.json().pagamento.valorCentavos).toBe(1000);
  expect(servicos.produtos.vendasDoAluno(alunoId).find((x) => x.id === v.id)).toMatchObject({ situacao: 'paga', forma: 'pix', pagaEm: '2026-10-10', pagamentoId: id, totalCentavos: 2500 });
  for (const campos of [{ forma: 'credito' }, { dataPagamento: '2026-10-11', forma: 'debito' }]) {
    expect((await pedir('PUT', `/api/pagamentos/${id}`, { senha, ...campos })).statusCode).toBe(200);
    expect(servicos.produtos.vendasDoAluno(alunoId).find((x) => x.id === v.id)).toMatchObject({ pagamentoId: id, situacao: 'paga', forma: campos.forma, pagaEm: 'dataPagamento' in campos ? campos.dataPagamento : '2026-10-10' });
  }
  expect((await pedir('DELETE', `/api/pagamentos/${id}`, { senha })).statusCode).toBe(200);
  expect(servicos.produtos.vendasDoAluno(alunoId).find((x) => x.id === v.id)).toMatchObject({ situacao: 'fiado', forma: null, pagaEm: null, pagamentoId: null });
  expect(servicos.produtos.vendasDoAluno(alunoId).find((x) => x.id === separada.id)).toEqual({ ...separada, alunoNome: 'Adrian', produtoNome: 'Creatina' });
});
it.each(['outro aluno', 'paga', 'inexistente'])('rollback de pagamento, cobrança, matrícula e vendas: %s', async (caso) => {
  const valida = vender();
  let invalida = 9999;
  if (caso === 'paga') invalida = vender({ situacao: 'paga', forma: 'pix' }).id;
  if (caso === 'outro aluno') {
    const outro = banco.db.insert(aluno).values({ nome: 'Outro', telefone: '11999990001' }).returning().get();
    invalida = vender({ alunoId: outro.id }).id;
  }
  const m = servicos.financeiro.registrarPagamento({ alunoId, planoId, valorCentavos: 1000, forma: 'pix', dataPagamento: '2026-09-10' }).matricula!;
  const c = banco.db.insert(cobranca).values({ alunoId, matriculaId: m.id, competencia: '2026-10', vencimento: '2026-10-10', valorCentavos: 1000 }).returning().get();
  const antes = estado();
  expect((await pagar({ cobrancaId: c.id, vendasIds: [valida.id, invalida] })).statusCode).toBe(400);
  expect(estado()).toEqual(antes);
});
it('boleto com produtos é recusado no cadastro e edição sem alterar nada', async () => {
  const v = vender(), antes = estado();
  const r = await pagar({ forma: 'boleto', vendasIds: [v.id] });
  expect(r.statusCode).toBe(400);
  expect(r.json()).toEqual({ erro: 'Boleto não recebe produto junto.' });
  expect(estado()).toEqual(antes);
  const pg = (await pagar({ vendasIds: [v.id] })).json().pagamento;
  const depois = estado();
  const edicao = await pedir('PUT', `/api/pagamentos/${pg.id}`, { senha, forma: 'boleto', dataPagamento: '2026-10-12' });
  expect(edicao.statusCode).toBe(400);
  expect(edicao.json()).toEqual({ erro: 'Boleto não recebe produto junto.' });
  expect(estado()).toEqual(depois);
  expect((await pagar({ forma: 'boleto' })).statusCode).toBe(201);
});
it.each([[0], [-1], [1.5], ['1'], Array(21).fill(1), '1'])('valida vendasIds %j', async (vendasIds) => {
  const antes = estado();
  expect((await pagar({ vendasIds })).statusCode).toBe(400);
  expect(estado()).toEqual(antes);
});
it('aceita 20 vendas e lista vazia, sem somar produtos à mensalidade', async () => {
  const vendasIds = Array.from({ length: 20 }, () => vender().id);
  const r = await pagar({ vendasIds });
  expect(r.statusCode).toBe(201);
  expect(r.json().pagamento.valorCentavos).toBe(1000);
  expect(servicos.produtos.vendasDoAluno(alunoId).every((v) => v.pagamentoId === r.json().pagamento.id)).toBe(true);
  expect((await pagar({ vendasIds: [], forma: 'boleto' })).statusCode).toBe(201);
});
it('migração 0005 preserva registros antigos e cria colunas nulas e FK', () => {
  const antigo = abrirBanco(':memory:');
  try {
    for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql') && f < '0005').sort()) antigo.sqlite.exec(readFileSync(`drizzle/${f}`, 'utf8'));
    antigo.sqlite.exec("INSERT INTO aluno (nome, telefone) VALUES ('Adrian', '11999990000'); INSERT INTO usuario (nome, email, papel, senha_hash) VALUES ('Dono', 'd@teste', 'dono', 'hash'); INSERT INTO produto (nome, preco_centavos, estoque) VALUES ('Creatina', 2500, 2); INSERT INTO pagamento (aluno_id, valor_centavos, forma, data_pagamento) VALUES (1, 1000, 'pix', '2026-10-10'); INSERT INTO venda (produto_id, aluno_id, quantidade, valor_unitario_centavos, total_centavos, situacao, data_venda, registrado_por_usuario_id) VALUES (1, 1, 1, 2500, 2500, 'fiado', '2026-10-10', 1);");
    const tabelas = ['aluno', 'usuario', 'produto', 'pagamento', 'venda'];
    const antes = tabelas.map((t) => antigo.sqlite.prepare(`SELECT * FROM ${t}`).all());
    antigo.sqlite.exec(readFileSync('drizzle/0005_observacao_produtos_aluno.sql', 'utf8'));
    tabelas.forEach((t, i) => {
      const depois = antigo.sqlite.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
      expect(depois).toHaveLength(antes[i].length);
      depois.forEach((r, j) => expect(r).toMatchObject(antes[i][j] as object));
    });
    expect(antigo.sqlite.prepare('SELECT observacao FROM aluno').get()).toEqual({ observacao: null });
    expect(antigo.sqlite.prepare('SELECT pagamento_id FROM venda').get()).toEqual({ pagamento_id: null });
    expect(() => antigo.sqlite.exec('UPDATE venda SET pagamento_id = 999')).toThrow();
    expect(antigo.sqlite.pragma('foreign_key_check')).toEqual([]);
  } finally { antigo.sqlite.close(); }
});
