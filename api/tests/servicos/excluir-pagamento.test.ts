import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { aluno, plano, matricula, cobranca, pagamento, usuario, sessao } from '../../src/db/schema.js';

const SENHA = 'senha-do-dono-123';
const OUTRA_SENHA = 'senha-outro-dono-456';
const RECUSA_ANTERIOR = 'Exclua primeiro o pagamento mais recente deste aluno.';
let banco: ReturnType<typeof criarBancoDeTeste>;
let servicos: ReturnType<typeof criarServicos>;
let servidor: FastifyInstance | undefined;
let alunoId: number, planoId: number;
let senhaHash: string, outraSenhaHash: string;

beforeAll(async () => {
  [senhaHash, outraSenhaHash] = await Promise.all([hashSenha(SENHA), hashSenha(OUTRA_SENHA)]);
});

beforeEach(() => {
  banco = criarBancoDeTeste();
  servicos = criarServicos(banco.db);
  alunoId = banco.db.insert(aluno).values({ nome: 'Aluno de teste', telefone: '+5511999990001' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 13900, duracaoMeses: 1 }).returning().get().id;
});

afterEach(async () => {
  await servidor?.close();
  servidor = undefined;
  banco.fechar();
});

const pagar = (cobrancaId?: number) => servicos.financeiro.registrarPagamento({
  alunoId, planoId, valorCentavos: 13900, forma: 'pix', dataPagamento: '2026-10-07', cobrancaId,
});
const atual = () => servicos.matriculas.matriculaAtualSync(alunoId);
const cobrar = (matriculaId: number, competencia = '2026-11', status: 'aberta' | 'paga' | 'cancelada' = 'aberta') =>
  banco.db.insert(cobranca).values({
    alunoId, matriculaId, competencia, valorCentavos: 13900, vencimento: `${competencia}-07`, status,
  }).returning().get();

describe('excluir pagamento', () => {
  it('grava o vínculo e desfaz o segundo pagamento duplicado, restaurando o primeiro vencimento', () => {
    const primeiro = pagar();
    const segundo = pagar();
    expect(primeiro.pagamento.matriculaId).toBe(primeiro.matricula!.id);
    expect(segundo.pagamento.matriculaId).toBe(segundo.matricula!.id);
    expect(atual()!.dataFim).toBe('2026-12-07');

    expect(servicos.financeiro.excluirPagamento(segundo.pagamento.id)).toEqual({
      ok: true, alunoId, dataFimNova: '2026-11-07',
    });
    expect(atual()!.id).toBe(primeiro.matricula!.id);
    expect(banco.db.select().from(matricula).all()).toHaveLength(1);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId).map((registro) => registro.id)).toEqual([primeiro.pagamento.id]);
    expect(servicos.financeiro.receitaDoMes('2026-10')).toBe(13900);
  });

  it('recusa pagamento com renovação posterior sem alterar os registros', () => {
    const primeiro = pagar();
    const segundo = pagar();
    expect(() => servicos.financeiro.excluirPagamento(primeiro.pagamento.id)).toThrow(RECUSA_ANTERIOR);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(2);
    expect(atual()!.id).toBe(segundo.matricula!.id);
  });

  it('excluir a primeira matrícula deixa o aluno sem vencimento', () => {
    const primeiro = pagar();
    expect(servicos.financeiro.excluirPagamento(primeiro.pagamento.id)).toEqual({ ok: true, alunoId, dataFimNova: null });
    expect(atual()).toBeNull();
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(0);
  });

  it('reabre a cobrança quitada e remove a cobrança automática do período desfeito', () => {
    const primeiro = pagar();
    const quitada = cobrar(primeiro.matricula!.id);
    const segundo = pagar(quitada.id);
    const futura = cobrar(segundo.matricula!.id, '2026-12');

    servicos.financeiro.excluirPagamento(segundo.pagamento.id);

    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, quitada.id)).get()!.status).toBe('aberta');
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, futura.id)).get()).toBeUndefined();
    expect(atual()!.id).toBe(primeiro.matricula!.id);
  });

  it('reabre quitação implícita, preservando cobranças canceladas ou com outro pagamento', () => {
    const primeiro = pagar();
    const implicita = cobrar(primeiro.matricula!.id);
    const independente = cobrar(primeiro.matricula!.id, '2026-10');
    const cancelada = cobrar(primeiro.matricula!.id, '2026-09', 'cancelada');
    servicos.financeiro.registrarPagamento({ alunoId, cobrancaId: independente.id, valorCentavos: 13900, forma: 'dinheiro' });
    const segundo = pagar();
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, implicita.id)).get()!.status).toBe('paga');

    servicos.financeiro.excluirPagamento(segundo.pagamento.id);

    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, implicita.id)).get()!.status).toBe('aberta');
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, independente.id)).get()!.status).toBe('paga');
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, cancelada.id)).get()!.status).toBe('cancelada');
  });

  it('apaga pagamento sem renovação sem desfazer uma matrícula vinculada a outro pagamento', () => {
    const primeiro = pagar();
    const avulso = servicos.financeiro.registrarPagamento({ alunoId, valorCentavos: 1000, forma: 'dinheiro' });
    const instante = '2026-10-07T12:00:00.000Z';
    banco.db.update(matricula).set({ criadoEm: instante }).run();
    banco.db.update(pagamento).set({ criadoEm: instante }).run();

    expect(servicos.financeiro.excluirPagamento(avulso.pagamento.id)).toEqual({
      ok: true, alunoId, dataFimNova: primeiro.matricula!.dataFim,
    });
    expect(atual()!.id).toBe(primeiro.matricula!.id);
  });

  it('preserva a matrícula enquanto houver outro pagamento de uma cobrança dela', () => {
    const primeiro = pagar();
    const proxima = cobrar(primeiro.matricula!.id);
    const avulso = servicos.financeiro.registrarPagamento({
      alunoId, cobrancaId: proxima.id, valorCentavos: 13900, forma: 'dinheiro',
    });
    expect(() => servicos.financeiro.excluirPagamento(primeiro.pagamento.id)).toThrow(RECUSA_ANTERIOR);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(2);
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, proxima.id)).get()!.status).toBe('paga');

    servicos.financeiro.excluirPagamento(avulso.pagamento.id);
    expect(servicos.financeiro.excluirPagamento(primeiro.pagamento.id).dataFimNova).toBeNull();
  });

  it.each([0, 60_000])('reconhece pagamento legado com matrícula criada %i ms depois', (intervalo) => {
    const primeiro = pagar();
    const segundo = pagar();
    const instante = '2026-10-07T12:00:00.000Z';
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: instante }).where(eq(pagamento.id, segundo.pagamento.id)).run();
    banco.db.update(matricula).set({ criadoEm: new Date(Date.parse(instante) + intervalo).toISOString() })
      .where(eq(matricula.id, segundo.matricula!.id)).run();

    expect(servicos.financeiro.excluirPagamento(segundo.pagamento.id).dataFimNova).toBe(primeiro.matricula!.dataFim);
    expect(atual()!.id).toBe(primeiro.matricula!.id);
  });

  it('não associa o legado a uma matrícula criada fora da janela de 60 segundos', () => {
    const primeiro = pagar();
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: '2026-10-07T12:00:00.000Z' }).run();
    banco.db.update(matricula).set({ criadoEm: '2026-10-07T12:01:00.001Z' }).run();

    expect(servicos.financeiro.excluirPagamento(primeiro.pagamento.id).dataFimNova).toBe(primeiro.matricula!.dataFim);
    expect(atual()!.id).toBe(primeiro.matricula!.id);
  });

  it('recusa legado cuja matrícula foi encerrada por uma renovação posterior com vínculo explícito', () => {
    const primeiro = pagar();
    const segundo = pagar();
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: '2026-10-07T12:00:00.000Z' })
      .where(eq(pagamento.id, primeiro.pagamento.id)).run();
    banco.db.update(matricula).set({ criadoEm: '2026-10-07T12:00:01.000Z' })
      .where(eq(matricula.id, primeiro.matricula!.id)).run();
    banco.db.update(matricula).set({ criadoEm: '2026-11-07T12:00:00.000Z' })
      .where(eq(matricula.id, segundo.matricula!.id)).run();

    expect(() => servicos.financeiro.excluirPagamento(primeiro.pagamento.id)).toThrow(RECUSA_ANTERIOR);
    expect(atual()!.id).toBe(segundo.matricula!.id);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(2);
  });

  it('desfaz dois pagamentos legados com o mesmo timestamp somente do mais recente para o anterior', () => {
    const primeiro = pagar();
    const segundo = pagar();
    const instante = '2026-10-07T12:00:00.000Z';
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: instante }).run();
    banco.db.update(matricula).set({ criadoEm: instante }).run();

    expect(() => servicos.financeiro.excluirPagamento(primeiro.pagamento.id)).toThrow(RECUSA_ANTERIOR);
    expect(servicos.financeiro.excluirPagamento(segundo.pagamento.id).dataFimNova).toBe(primeiro.matricula!.dataFim);
    expect(servicos.financeiro.excluirPagamento(primeiro.pagamento.id).dataFimNova).toBeNull();
  });

  it('restaura todos os registros quando a reativação da matrícula anterior falha', () => {
    const primeiro = pagar();
    const quitada = cobrar(primeiro.matricula!.id);
    const segundo = pagar(quitada.id);
    const futura = cobrar(segundo.matricula!.id, '2026-12');
    banco.sqlite.exec(`
      CREATE TRIGGER falha_reativacao BEFORE UPDATE ON matricula
      WHEN NEW.status = 'ativa'
      BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;
    `);

    expect(() => servicos.financeiro.excluirPagamento(segundo.pagamento.id)).toThrow('falha simulada');
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(2);
    expect(atual()!.id).toBe(segundo.matricula!.id);
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, quitada.id)).get()!.status).toBe('paga');
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, futura.id)).get()!.status).toBe('aberta');
    expect(banco.db.select().from(matricula).where(eq(matricula.id, primeiro.matricula!.id)).get()!.status).toBe('encerrada');
  });
});

describe('DELETE /api/pagamentos/:id', () => {
  beforeEach(async () => {
    const pessoas = banco.db.insert(usuario).values([
      { nome: 'Dono de teste', email: 'dono@teste.local', papel: 'dono', senhaHash },
      { nome: 'Outro dono', email: 'outro@teste.local', papel: 'dono', senhaHash: outraSenhaHash },
      { nome: 'Recepção de teste', email: 'recepcao@teste.local', papel: 'recepcao', senhaHash },
      { nome: 'Professor de teste', email: 'professor@teste.local', papel: 'professor', senhaHash },
    ]).returning().all();
    banco.db.insert(sessao).values(pessoas.map((pessoa) => ({
      usuarioId: pessoa.id, token: pessoa.email, expiraEm: '2099-01-01T00:00:00.000Z',
    }))).run();
    servidor = construirServidor({ db: banco.db });
    await servidor.ready();
  });

  const excluir = (pagamentoId: number | string, senha = SENHA, pessoa = 'dono') => servidor!.inject({
    method: 'DELETE', url: `/api/pagamentos/${pagamentoId}`, payload: { senha },
    headers: { authorization: `Bearer ${pessoa}@teste.local` },
  });

  it('dono confirma a própria senha e recebe exatamente o contrato da resposta', async () => {
    const primeiro = pagar();
    const segundo = pagar();
    const resposta = await excluir(segundo.pagamento.id);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, alunoId, dataFimNova: primeiro.matricula!.dataFim });
  });

  it.each(['incorreta', OUTRA_SENHA])('recusa senha incorreta ou de outro dono: %s', async (senha) => {
    const primeiro = pagar();
    const resposta = await excluir(primeiro.pagamento.id, senha);
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: 'Senha incorreta.' });
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(1);
    expect(atual()!.id).toBe(primeiro.matricula!.id);
  });

  it.each(['recepcao', 'professor'])('recusa perfil %s com 403', async (pessoa) => {
    const primeiro = pagar();
    expect((await excluir(primeiro.pagamento.id, SENHA, pessoa)).statusCode).toBe(403);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(1);
  });

  it('exige sessão autenticada', async () => {
    const primeiro = pagar();
    const resposta = await servidor!.inject({ method: 'DELETE', url: `/api/pagamentos/${primeiro.pagamento.id}`, payload: { senha: SENHA } });
    expect(resposta.statusCode).toBe(401);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(1);
  });

  it('valida a senha obrigatória e o identificador antes de excluir', async () => {
    const primeiro = pagar();
    const resposta = await servidor!.inject({
      method: 'DELETE', url: `/api/pagamentos/${primeiro.pagamento.id}`, payload: {},
      headers: { authorization: 'Bearer dono@teste.local' },
    });
    expect(resposta.statusCode).toBe(400);
    expect((await excluir('invalido')).statusCode).toBe(400);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(1);
  });

  it('retorna 404 quando o pagamento não existe', async () => {
    const resposta = await excluir(9999);
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Pagamento não encontrado' });
  });

  it('retorna 400 com a mensagem contratada ao excluir pagamento antigo', async () => {
    const primeiro = pagar();
    pagar();
    const resposta = await excluir(primeiro.pagamento.id);
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: RECUSA_ANTERIOR });
  });

  it('limita tentativas de senha antes de executar outra verificação, com Retry-After', async () => {
    const primeiro = pagar();
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      expect((await excluir(primeiro.pagamento.id, 'incorreta')).statusCode).toBe(400);
    }
    const resposta = await excluir(primeiro.pagamento.id);
    expect(resposta.statusCode).toBe(429);
    expect(Number(resposta.headers['retry-after'])).toBeGreaterThan(0);
    expect(servicos.financeiro.pagamentosDoAluno(alunoId)).toHaveLength(1);
  });
});
