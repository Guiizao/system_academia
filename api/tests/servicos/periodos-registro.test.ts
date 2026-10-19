import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicos } from '../../src/servidor.js';
import { aluno, plano, pagamento, matricula, cobranca, usuario } from '../../src/db/schema.js';

let banco: ReturnType<typeof criarBancoDeTeste>;
let s: ReturnType<typeof criarServicos>;
let alunoId: number, planoId: number, usuarioId: number;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T15:00:00Z'));
  banco = criarBancoDeTeste();
  s = criarServicos(banco.db);
  alunoId = banco.db.insert(aluno).values({ nome: 'Aluno de teste', telefone: '+5511999990001' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', duracaoMeses: 1, precoCentavos: 10000 }).returning().get().id;
  usuarioId = banco.db.insert(usuario).values({ nome: 'Operador', email: 'operador@teste', papel: 'dono' }).returning().get().id;
});
afterEach(() => { banco.fechar(); vi.useRealTimers(); });

function pagar(dados: Partial<Parameters<typeof s.financeiro.registrarPagamento>[0]> = {}) {
  return s.financeiro.registrarPagamento({ alunoId, planoId, valorCentavos: 20000, forma: 'pix', dataPagamento: '2026-10-10', usuarioId, ...dados });
}
function estado() {
  return {
    pagamentos: banco.db.select().from(pagamento).all(),
    matriculas: banco.db.select().from(matricula).all(),
    cobrancas: banco.db.select().from(cobranca).all(),
  };
}
function diaria() {
  return banco.db.insert(plano).values({ nome: 'Diária', duracaoMeses: 0, duracaoDias: 1, precoCentavos: 2500 }).returning().get().id;
}

describe('períodos persistidos e correções de data', () => {
  it.each([undefined, 2, 12])('registra a quantidade usada (%s) e preserva ao corrigir data', (periodos) => {
    const r = pagar({ periodos });
    expect(r.pagamento).toMatchObject({ periodos: periodos ?? 1 });
    const editado = s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11' });
    expect(editado.pagamento).toMatchObject({ periodos: periodos ?? 1 });
    expect(editado.dataFimNova).toBe(periodos === 12 ? '2027-10-11' : periodos === 2 ? '2026-12-11' : '2026-11-11');
  });

  it('trocar plano sem informar períodos mantém dois períodos do novo plano', () => {
    const r = pagar({ periodos: 2 });
    const trimestral = banco.db.insert(plano).values({ nome: 'Trimestral', duracaoMeses: 3, precoCentavos: 27000 }).returning().get();
    expect(s.financeiro.editarPagamento(r.pagamento.id, { planoId: trimestral.id }))
      .toMatchObject({ dataFimNova: '2027-04-10', pagamento: { periodos: 2, planoId: trimestral.id } });
  });

  it('preserva períodos inferidos do legado acima do limite de novas vendas', () => {
    const r = pagar({ dataFimManual: '2028-01-10' });
    // A migração infere 15 meses deste vencimento antigo, que era permitido.
    banco.db.update(pagamento).set({ periodos: 15 }).where(eq(pagamento.id, r.pagamento.id)).run();
    expect(s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11' }))
      .toMatchObject({ dataFimNova: '2028-01-11', pagamento: { periodos: 15 } });
    const trimestral = banco.db.insert(plano).values({ nome: 'Trimestral', duracaoMeses: 3, precoCentavos: 27000 }).returning().get();
    expect(s.financeiro.editarPagamento(r.pagamento.id, { planoId: trimestral.id }))
      .toMatchObject({ dataFimNova: '2030-07-11', pagamento: { periodos: 15 } });
    expect(() => s.financeiro.editarPagamento(r.pagamento.id, { periodos: 16 })).toThrow(/1 a 12/);
    expect(() => pagar({ periodos: 15 })).toThrow(/1 a 12/);
  });

  it('repetir plano e períodos de pagamento antigo não refaz a matrícula', () => {
    const r = pagar({ periodos: 2 });
    pagar();
    const antes = estado().matriculas;
    expect(s.financeiro.editarPagamento(r.pagamento.id, { planoId, periodos: 2, valorCentavos: 19000 }).pagamento)
      .toMatchObject({ periodos: 2, valorCentavos: 19000 });
    expect(estado().matriculas).toEqual(antes);
  });

  it('corrigir valor preserva períodos, matrícula e cobrança; períodos explícitos substituem', () => {
    const r = pagar({ periodos: 2 });
    banco.db.insert(cobranca).values({ alunoId, matriculaId: r.matricula!.id, competencia: '2026-12', vencimento: '2026-12-10', valorCentavos: 10000 }).run();
    const antes = estado();
    expect(s.financeiro.editarPagamento(r.pagamento.id, { valorCentavos: 19000 }).pagamento).toMatchObject({ periodos: 2 });
    expect(estado().matriculas).toEqual(antes.matriculas);
    expect(estado().cobrancas).toEqual(antes.cobrancas);
    expect(s.financeiro.editarPagamento(r.pagamento.id, { periodos: 3 }))
      .toMatchObject({ dataFimNova: '2027-01-10', pagamento: { periodos: 3 } });
  });

  it('avulso mantém períodos nulos; adicionar plano assume um período', () => {
    const r = pagar({ planoId: undefined });
    expect(r.pagamento).toMatchObject({ periodos: null });
    expect(s.financeiro.editarPagamento(r.pagamento.id, { valorCentavos: 1000 }).pagamento).toMatchObject({ periodos: null });
    expect(s.financeiro.editarPagamento(r.pagamento.id, { planoId }).pagamento).toMatchObject({ periodos: 1 });
  });

  it('diária grava um período e mantém o dia agendado ao corrigir a data do recebimento', () => {
    const r = pagar({ planoId: diaria(), dataInicioEscolhida: '2026-10-25' });
    expect(r.pagamento).toMatchObject({ periodos: 1 });
    expect(s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11' }).dataFimNova).toBe('2026-10-25');
    expect(s.matriculas.matriculaAtualSync(alunoId)).toMatchObject({ dataInicio: '2026-10-25', dataFim: '2026-10-25' });
  });

  it('diária sem agendamento acompanha a data corrigida', () => {
    const r = pagar({ planoId: diaria() });
    expect(s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11' }).dataFimNova).toBe('2026-10-11');
  });

  it('vencimento manual é preservado na correção da data e recalculado se períodos mudarem', () => {
    const r = pagar({ periodos: 2, dataFimManual: '2027-01-20' });
    expect(s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11' }).dataFimNova).toBe('2027-01-20');
    expect(s.financeiro.editarPagamento(r.pagamento.id, { periodos: 3 }).dataFimNova).toBe('2027-01-11');
  });

  it('recusa data que faria o início ultrapassar o vencimento manual, com rollback', () => {
    const r = pagar({ dataFimManual: '2026-10-12' });
    const antes = estado();
    expect(() => s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-15' })).toThrow(/antes do início/);
    expect(estado()).toEqual(antes);
  });

  it('recusa renovação anterior ao pagamento precedente, aceita a mesma data', () => {
    pagar({ dataPagamento: '2026-10-09' });
    const r = pagar();
    const antes = estado();
    expect(() => s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-08' })).toThrow(/pagamento anterior/);
    expect(estado()).toEqual(antes);
    expect(s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-09' }).dataFimNova).toBe('2026-12-09');
  });

  it('avulso pode corrigir data para antes do pagamento precedente', () => {
    pagar();
    const r = pagar({ planoId: undefined });
    const antes = estado().matriculas;
    expect(s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-01' }).pagamento.dataPagamento).toBe('2026-10-01');
    expect(estado().matriculas).toEqual(antes);
  });

  it.each(['registrar', 'editar'])('recusa data futura ao %s sem modificar banco', (acao) => {
    const r = pagar();
    const antes = estado();
    expect(() => acao === 'registrar' ? pagar({ dataPagamento: '2026-10-20' })
      : s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-20' }))
      .toThrow('A data do pagamento não pode ser depois de hoje.');
    expect(estado()).toEqual(antes);
  });

  it('aceita hoje pelo fuso de São Paulo, recusa o dia UTC seguinte', () => {
    vi.setSystemTime(new Date('2026-10-20T01:30:00Z'));
    expect(pagar({ dataPagamento: '2026-10-19' }).pagamento.dataPagamento).toBe('2026-10-19');
    expect(() => pagar({ dataPagamento: '2026-10-20' })).toThrow('A data do pagamento não pode ser depois de hoje.');
  });
});

describe('registro transacional de alterações', () => {
  it('detalhe mostra o responsável original e distingue pagamento editado', () => {
    const r = pagar({ periodos: 2 });
    expect(s.financeiro.pagamentosDoAluno(alunoId)[0]).toMatchObject({ registradoPorNome: 'Operador', editado: false, periodos: 2 });
    expect(s.financeiro.editarPagamento(r.pagamento.id, { forma: 'dinheiro' }, usuarioId).pagamento)
      .toMatchObject({ registradoPorNome: 'Operador', editado: true });
    banco.db.update(pagamento).set({ registradoPorUsuarioId: null }).where(eq(pagamento.id, r.pagamento.id)).run();
    expect(s.financeiro.pagamentosDoAluno(alunoId)[0]).toMatchObject({ registradoPorNome: null, editado: true });
  });

  it('refazer matrícula gera uma edição; excluir mantém os snapshots mesmo sem pagamento', () => {
    const r = pagar({ periodos: 2 });
    s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11', observacao: 'Corrigido' }, usuarioId);
    s.financeiro.excluirPagamento(r.pagamento.id, usuarioId);
    const logs = s.financeiro.alteracoes({ pagamentoId: r.pagamento.id });
    const antes = { dataPagamento: '2026-10-10', valorCentavos: 20000, forma: 'pix', planoNome: 'Mensal', periodos: 2, observacao: null };
    const depois = { ...antes, dataPagamento: '2026-10-11', observacao: 'Corrigido' };
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual({ id: expect.any(Number), acao: 'excluiu', em: expect.any(String), usuarioNome: 'Operador', alunoNome: 'Aluno de teste', pagamentoId: r.pagamento.id, antes: depois, depois: null });
    expect(logs[1]).toEqual({ id: expect.any(Number), acao: 'editou', em: expect.any(String), usuarioNome: 'Operador', alunoNome: 'Aluno de teste', pagamentoId: r.pagamento.id, antes, depois });
    expect(estado().pagamentos).toEqual([]);
  });

  it.each(['editar', 'excluir'])('falha ao registrar alteração desfaz toda a operação: %s', (acao) => {
    const r = pagar({ periodos: 2 });
    banco.sqlite.exec("CREATE TRIGGER falha_auditoria BEFORE INSERT ON pagamento_alteracao BEGIN SELECT RAISE(ABORT, 'falha de auditoria'); END;");
    const antes = estado();
    expect(() => acao === 'editar' ? s.financeiro.editarPagamento(r.pagamento.id, { dataPagamento: '2026-10-11' }, usuarioId)
      : s.financeiro.excluirPagamento(r.pagamento.id, usuarioId)).toThrow('falha de auditoria');
    expect(estado()).toEqual(antes);
    expect(s.financeiro.alteracoes()).toEqual([]);
  });

  it('edição inválida não deixa registro nem marca editado', () => {
    const r = pagar();
    expect(() => s.financeiro.editarPagamento(r.pagamento.id, { planoId: 999 }, usuarioId)).toThrow();
    expect(s.financeiro.alteracoes()).toEqual([]);
    expect(s.financeiro.pagamentosDoAluno(alunoId)[0]).toMatchObject({ editado: false });
  });
});
