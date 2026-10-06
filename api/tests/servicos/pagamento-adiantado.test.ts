/**
 * Os dois pedidos que o Joao mandou por audio em 06/10/2026.
 *
 * 1. "Hoje e dia 6, o vencimento dela e dia 10. Ela paga hoje. O mes que
 *    vem tem que vencer dia 10, nao dia 6" -- quem paga adiantado nao pode
 *    perder os dias que ainda tinha.
 * 2. "Tem cliente que gosta de adiantar o pagamento do mes seguinte. A moca
 *    ja adiantou novembro; da para jogar o vencimento dela para dezembro?"
 *    -- pagamento empilha, nao substitui.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoFinanceiro } from '../../src/servicos/financeiro.js';
import { criarServicoMatriculas } from '../../src/servicos/matriculas.js';
import { eq } from 'drizzle-orm';
import { aluno, plano, academia, matricula } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
afterEach(() => t?.fechar());

async function cenario(vencimentoAtual: string | null) {
  t = criarBancoDeTeste();
  const financeiro = criarServicoFinanceiro(t.db as any);
  const matriculas = criarServicoMatriculas(t.db as any);
  await t.db.insert(academia).values({ nome: 'DARK FISIC' });
  const [a] = await t.db.insert(aluno).values({ nome: 'Aline', telefone: '+5511980001111' }).returning();
  const [p] = await t.db.insert(plano).values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning();
  if (vencimentoAtual) {
    await t.db.insert(matricula).values({
      alunoId: a.id, planoId: p.id, dataInicio: '2026-09-10', dataFim: vencimentoAtual,
      diaAncora: Number(vencimentoAtual.slice(8, 10)), valorCentavos: p.precoCentavos, status: 'ativa',
    });
  }
  const pagar = (dataPagamento: string) => financeiro.registrarPagamento({
    alunoId: a.id, valorCentavos: p.precoCentavos, forma: 'dinheiro', planoId: p.id, dataPagamento,
  });
  const vencimento = async () => (await matriculas.matriculaAtual(a.id))!.dataFim;
  return { pagar, vencimento, alunoId: a.id, planoId: p.id, financeiro };
}

describe('pagamento adiantado nao encurta o mes', () => {
  it('vence dia 10, paga dia 6: o proximo vence dia 10, nao dia 6', async () => {
    const c = await cenario('2026-10-10');
    await c.pagar('2026-10-06');
    expect(await c.vencimento()).toBe('2026-11-10');
  });

  it('paga no proprio dia do vencimento: emenda sem perder nada', async () => {
    const c = await cenario('2026-10-10');
    await c.pagar('2026-10-10');
    expect(await c.vencimento()).toBe('2026-11-10');
  });

  it('paga atrasado: ai sim conta da data do pagamento', async () => {
    const c = await cenario('2026-10-10');
    await c.pagar('2026-10-15');
    expect(await c.vencimento()).toBe('2026-11-15');
  });
});

describe('adiantar meses empilha o vencimento', () => {
  it('ja pagou ate 10/11 e adianta dezembro: vai para 10/12', async () => {
    const c = await cenario('2026-10-10');
    await c.pagar('2026-10-06');            // paga outubro->novembro
    expect(await c.vencimento()).toBe('2026-11-10');
    await c.pagar('2026-10-06');            // adianta novembro->dezembro
    expect(await c.vencimento()).toBe('2026-12-10');
  });

  it('tres meses de uma vez, um pagamento de cada vez', async () => {
    const c = await cenario('2026-10-10');
    for (let i = 0; i < 3; i++) await c.pagar('2026-10-06');
    expect(await c.vencimento()).toBe('2027-01-10');
  });

  it('o dia 31 sobrevive ao mes curto: 31/10 -> 30/11 -> 31/12', async () => {
    const c = await cenario('2026-10-31');
    await c.pagar('2026-10-20');
    expect(await c.vencimento()).toBe('2026-11-30');
    await c.pagar('2026-10-20');
    expect(await c.vencimento()).toBe('2026-12-31');
  });
});

describe('adiantar num pagamento so', () => {
  it('2 periodos de uma vez dao o mesmo que dois pagamentos seguidos', async () => {
    const c = await cenario('2026-10-10');
    await c.financeiro.registrarPagamento({
      alunoId: c.alunoId, valorCentavos: 27800, forma: 'dinheiro',
      planoId: c.planoId, dataPagamento: '2026-10-06', periodos: 2,
    });
    expect(await c.vencimento()).toBe('2026-12-10');
  });

  it('a matricula guarda o valor dos periodos pagos, nao o de um so', async () => {
    const c = await cenario('2026-10-10');
    await c.financeiro.registrarPagamento({
      alunoId: c.alunoId, valorCentavos: 41700, forma: 'pix',
      planoId: c.planoId, dataPagamento: '2026-10-06', periodos: 3,
    });
    const m = await t.db.select().from(matricula).where(eq(matricula.status, 'ativa')).get();
    expect(m!.valorCentavos).toBe(13900 * 3);
    expect(m!.dataFim).toBe('2027-01-10');
  });

  it('recusa quantidade fora da faixa', async () => {
    const c = await cenario('2026-10-10');
    expect(() => c.financeiro.registrarPagamento({
      alunoId: c.alunoId, valorCentavos: 13900, forma: 'dinheiro',
      planoId: c.planoId, dataPagamento: '2026-10-06', periodos: 13,
    })).toThrow(/1 a 12/);
  });
});

describe('previa: o que a recepcao le antes de confirmar', () => {
  it('mostra o vencimento que vai sair e os dias que o aluno aproveitou', async () => {
    const c = await cenario('2026-10-10');
    const matriculas = criarServicoMatriculas(t.db as any);
    const p = matriculas.previa({ alunoId: c.alunoId, planoId: c.planoId, dataPagamento: '2026-10-06' });
    expect(p.dataFim).toBe('2026-11-10');
    expect(p.dataFimAnterior).toBe('2026-10-10');
    expect(p.diasAproveitados).toBe(4);     // os 4 dias do audio do Joao
  });

  it('pagou atrasado: nao aproveita dia nenhum e conta do pagamento', async () => {
    const c = await cenario('2026-10-10');
    const matriculas = criarServicoMatriculas(t.db as any);
    const p = matriculas.previa({ alunoId: c.alunoId, planoId: c.planoId, dataPagamento: '2026-10-15' });
    expect(p.dataFim).toBe('2026-11-15');
    expect(p.diasAproveitados).toBe(0);
  });

  it('a previa nao grava nada: o vencimento continua o mesmo depois dela', async () => {
    const c = await cenario('2026-10-10');
    const matriculas = criarServicoMatriculas(t.db as any);
    matriculas.previa({ alunoId: c.alunoId, planoId: c.planoId, dataPagamento: '2026-10-06', periodos: 3 });
    expect(await c.vencimento()).toBe('2026-10-10');
  });

  it('a previa cobra o preco vezes os periodos', async () => {
    const c = await cenario('2026-10-10');
    const matriculas = criarServicoMatriculas(t.db as any);
    expect(matriculas.previa({ alunoId: c.alunoId, planoId: c.planoId, dataPagamento: '2026-10-06', periodos: 2 }).valorCentavos)
      .toBe(13900 * 2);
  });
});
