import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { aluno, cobranca, pagamento, plano, sessao, usuario } from '../../src/db/schema.js';
import { importarDaPasta } from '../../src/servicos/importacao.js';

let banco: ReturnType<typeof criarBancoDeTeste>;
let app: ReturnType<typeof construirServidor>;
let s: ReturnType<typeof criarServicos>;
let alunoId: number, planoId: number;

beforeEach(() => {
  banco = criarBancoDeTeste();
  const pessoas = banco.db.insert(usuario).values(
    (['dono', 'recepcao', 'professor'] as const).map((papel) => ({ nome: papel, email: `${papel}@teste.local`, papel })),
  ).returning().all();
  banco.db.insert(sessao).values(pessoas.map((p) => ({
    usuarioId: p.id, token: p.papel, expiraEm: '2099-01-01T00:00:00.000Z',
  }))).run();
  alunoId = banco.db.insert(aluno).values({ nome: 'Aluno de teste', telefone: '11999990000' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', duracaoMeses: 1, precoCentavos: 9000 }).returning().get().id;
  app = construirServidor({ db: banco.db });
  s = criarServicos(banco.db);
});

describe('conferência de dinheiro e importação', () => {
  it('concilia receita, caixa, relatório e painel ao editar/excluir recebimento com produto', () => {
    const produto = s.produtos.criar({ nome: 'Garrafa', precoCentavos: 2000, estoque: 2 });
    const dono = banco.db.select().from(usuario).where(eq(usuario.papel, 'dono')).get()!;
    const venda = s.produtos.registrarVenda({
      produtoId: produto.id, quantidade: 1, alunoId, situacao: 'fiado', registradoPorUsuarioId: dono.id,
    });
    const pg = pagar({ dataPagamento: '2025-12-31', vendasIds: [venda.id, venda.id] });
    const conferir = (data: string, total: number, quantidade: number) => {
      const mes = data.slice(0, 7);
      expect(s.financeiro.receitaDoMes(mes)).toBe(total);
      expect(s.financeiro.recebidoEm(data)).toBe(total);
      expect(s.financeiro.historico({ mes })).toMatchObject({ totalCentavos: total, quantidade });
      expect(s.relatorios.doMes(mes)).toMatchObject({ receitaCentavos: total, pagamentos: quantidade });
      expect(s.dashboard.resumo(data)).toMatchObject({ receitaMesCentavos: total, recebidoHojeCentavos: total });
    };
    conferir('2025-12-31', 9000, 1);
    s.financeiro.editarPagamento(pg.pagamento.id, { dataPagamento: '2026-01-01', valorCentavos: 8500, forma: 'dinheiro' });
    conferir('2025-12-31', 0, 0);
    conferir('2026-01-01', 8500, 1);
    expect(s.produtos.vendasDoAluno(alunoId)[0]).toMatchObject({ totalCentavos: 2000, pagaEm: '2026-01-01', forma: 'dinheiro' });
    s.produtos.excluirVenda(venda.id);
    expect(s.produtos.listar()[0].estoque).toBe(2);
    conferir('2026-01-01', 8500, 1);
    s.financeiro.excluirPagamento(pg.pagamento.id);
    conferir('2026-01-01', 0, 0);
  });

  it('repetir o mesmo JSON na pasta não duplica alunos, planos, matrículas nem pagamentos', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'df-caca-bugs-'));
    const entrada = {
      formato: 'darkfisic-importacao', versao: 1,
      planos: [{ nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1 }],
      alunos: [{ nome: 'Importado de teste', telefone: null, aceitaWhatsapp: false, plano: 'Mensal',
        matricula: { dataInicio: '2025-12-31', dataFim: '2026-01-31' },
        pagamentos: [{ data: '2025-12-31', valorCentavos: 9000, forma: 'pix' }] }],
    };
    try {
      writeFileSync(join(pasta, 'primeiro.json'), JSON.stringify(entrada));
      const opcoes = { fazerBackup: () => 'backup-simulado' };
      expect(importarDaPasta(banco.db, pasta, opcoes)[0]).toMatchObject({
        situacao: 'importado', resumo: { alunosCriados: 1, planosCriados: 0, matriculas: 1, pagamentos: 1 },
      });
      writeFileSync(join(pasta, 'repetido.json'), JSON.stringify(entrada));
      expect(importarDaPasta(banco.db, pasta, opcoes)[0]).toMatchObject({
        situacao: 'importado', resumo: { alunosCriados: 0, planosCriados: 0, matriculas: 0, pagamentos: 0 },
      });
      expect(s.financeiro.receitaDoMes('2025-12')).toBe(9000);
    } finally { rmSync(pasta, { recursive: true, force: true }); }
  });
});
afterEach(async () => { await app.close(); banco.fechar(); });

const pagar = (campos = {}) => s.financeiro.registrarPagamento({
  alunoId, planoId, valorCentavos: 9000, forma: 'pix', dataPagamento: '2026-01-01', ...campos,
});
const cadastro = () => banco.db.select().from(aluno).where(eq(aluno.id, alunoId)).get()!;

describe('acesso de aluno desativado', () => {
  it.each(['dono', 'recepcao', 'professor'])('recusa check-in pelo perfil %s sem gravar entrada', async (papel) => {
    s.alunos.atualizar(alunoId, { ativo: false });
    const resposta = await app.inject({
      method: 'POST', url: '/api/checkins', headers: { authorization: `Bearer ${papel}` },
      payload: { alunoId, atividade: 'Musculação' },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toContain('desativado');
    expect(s.checkins.doAluno(alunoId)).toEqual([]);
  });

  it('professor não reativa cadastro desativado pela recepção', async () => {
    s.alunos.atualizar(alunoId, { ativo: false });
    const resposta = await app.inject({
      method: 'PUT', url: `/api/alunos/${alunoId}`, headers: { authorization: 'Bearer professor' },
      payload: { ativo: true, nome: 'Não deve mudar' },
    });
    expect(resposta.statusCode).toBe(403);
    expect(cadastro()).toMatchObject({ ativo: false, nome: 'Aluno de teste' });
  });

  it.each(['dono', 'recepcao'])('%s pode reativar e registrar check-in', async (papel) => {
    s.alunos.atualizar(alunoId, { ativo: false });
    const headers = { authorization: `Bearer ${papel}` };
    expect((await app.inject({ method: 'PUT', url: `/api/alunos/${alunoId}`, headers, payload: { ativo: true } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/checkins', headers, payload: { alunoId, atividade: 'Musculação' } })).statusCode).toBe(201);
    expect(s.checkins.doAluno(alunoId)).toHaveLength(1);
  });
});

describe('exclusão de pagamento depois da saída do aluno', () => {
  it.each([true, false])('não recria dívida de cadastro desativado (cobrança explícita: %s)', (explicita) => {
    pagar();
    const [c] = s.financeiro.cobrancasAbertas('2026-02-01');
    const segundo = pagar({ dataPagamento: '2026-02-01', ...(explicita ? { cobrancaId: c.id } : {}) });
    s.alunos.atualizar(alunoId, { ativo: false });
    s.financeiro.excluirPagamento(segundo.pagamento.id);
    expect(s.financeiro.cobrancasAbertas('2026-03-10')).toEqual([]);
    expect(s.financeiro.inadimplencia('2026-03-10')).toBe(0);
    expect(banco.db.select().from(cobranca).where(eq(cobranca.id, c.id)).get()!.status).toBe('cancelada');
    expect(banco.db.select().from(pagamento).all()).toHaveLength(1);
    expect(s.financeiro.receitaDoMes('2026-02')).toBe(0);
  });

  it('não reabre cobrança de matrícula inativada ao excluir pagamento avulso', () => {
    pagar();
    const [c] = s.financeiro.cobrancasAbertas('2026-02-01');
    const avulso = pagar({ planoId: undefined, cobrancaId: c.id });
    s.financeiro.excluirPagamento(avulso.pagamento.id);
    // Repetir o recebimento e inativar deixa a cobrança paga; a exclusão
    // deve respeitar a matrícula encerrada, sem ressuscitar inadimplência.
    const recebido = pagar({ planoId: undefined, cobrancaId: c.id });
    s.alunos.inativar(alunoId);
    s.financeiro.excluirPagamento(recebido.pagamento.id);
    expect(s.financeiro.cobrancasAbertas('2026-03-10')).toEqual([]);
    expect(s.financeiro.inadimplencia('2026-03-10')).toBe(0);
  });
});
