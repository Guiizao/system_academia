import { describe, it, expect } from 'vitest';
import { mesesPagos, resumoPagos, trechoPago } from '../src/dominio/meses-pagos';

const per = (dataInicio: string, dataFim: string) => ({ dataInicio, dataFim });
const pagos = (meses: ReturnType<typeof mesesPagos>) => meses.filter((m) => m.pago).map((m) => m.mes);

describe('linha do tempo dos meses pagos', () => {
  it('pagou outubro a janeiro de uma vez: os quatro meses ficam pagos, fevereiro só tem a sobra até o vencimento', () => {
    const m = mesesPagos([per('2026-10-05', '2027-02-05')], '2026-10-20', 'ativo');
    expect(pagos(m)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(m.at(-1)?.mes).toBe('2027-02');
    expect(m.find((x) => x.mes === '2027-02')?.faixas).toEqual([{ de: 0, ate: 5 / 28, tipo: 'pago' }]);
  });

  it('renovações seguidas viram uma faixa só dentro do mês, sem emenda', () => {
    const m = mesesPagos([per('2026-09-05', '2026-10-05'), per('2026-10-05', '2026-11-05')], '2026-10-20', 'ativo');
    expect(m.find((x) => x.mes === '2026-10')?.faixas).toEqual([{ de: 0, ate: 1, tipo: 'pago' }]);
  });

  it('vencido: do dia seguinte ao vencimento até hoje fica vermelho', () => {
    const m = mesesPagos([per('2026-09-06', '2026-10-06')], '2026-10-20', 'vencido');
    const out = m.find((x) => x.mes === '2026-10')!;
    expect(out.faixas).toEqual([{ de: 0, ate: 6 / 31, tipo: 'pago' }, { de: 6 / 31, ate: 20 / 31, tipo: 'vencido' }]);
    expect(out.hoje).toBeCloseTo(19.5 / 31);
  });

  it('diária de um dia aparece: o dia do vencimento ainda vale', () => {
    const m = mesesPagos([per('2026-10-15', '2026-10-15')], '2026-10-20', 'ativo');
    expect(m.find((x) => x.mes === '2026-10')?.faixas).toEqual([{ de: 14 / 31, ate: 15 / 31, tipo: 'pago' }]);
  });

  it('inativo não fica vermelho: ele saiu, não está devendo', () => {
    const m = mesesPagos([per('2026-08-06', '2026-09-06')], '2026-10-20', 'inativo');
    expect(m.flatMap((x) => x.faixas).some((f) => f.tipo === 'vencido')).toBe(false);
  });

  it('nunca passa de 12 meses e sempre mostra o mês de hoje', () => {
    const m = mesesPagos([per('2024-01-10', '2027-12-10')], '2026-10-20', 'ativo');
    expect(m).toHaveLength(12);
    expect(m.some((x) => x.mes === '2026-10')).toBe(true);
  });

  it('diária marcada para daqui a meses: a linha começa no mês de hoje', () => {
    const m = mesesPagos([per('2026-12-05', '2026-12-05')], '2026-10-20', 'vencendo');
    expect(m.map((x) => x.mes)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(m[0].hoje).not.toBeNull();
  });

  it('o trecho pago sem buraco que termina no último vencimento', () => {
    expect(trechoPago([per('2026-08-05', '2026-09-05'), per('2026-09-05', '2026-10-05'), per('2026-10-05', '2026-11-05')]))
      .toEqual({ de: '2026-08-05', ate: '2026-11-05' });
    // voltou depois de um tempo parado: conta só a volta
    expect(trechoPago([per('2026-01-10', '2026-02-10'), per('2026-09-20', '2026-10-20')]))
      .toEqual({ de: '2026-09-20', ate: '2026-10-20' });
    // diárias em dias seguidos se emendam
    expect(trechoPago([per('2026-10-14', '2026-10-14'), per('2026-10-15', '2026-10-15')]))
      .toEqual({ de: '2026-10-14', ate: '2026-10-15' });
    expect(trechoPago([])).toBeNull();
  });

  it('mostra o ano no primeiro mês e em janeiro', () => {
    const m = mesesPagos([per('2026-10-05', '2027-02-05')], '2026-10-20', 'ativo');
    expect(m.map((x) => x.ano)).toEqual(['2026', null, null, '2027', null]);
  });

  it('sem período nenhum: nada para desenhar', () => {
    expect(mesesPagos([], '2026-10-20', 'inativo')).toEqual([]);
  });

  it('o resumo diz até quando está pago, ou desde quando venceu', () => {
    expect(resumoPagos([per('2026-10-05', '2027-02-05')], '2026-10-20')).toBe('Pago até 05/02/2027');
    expect(resumoPagos([per('2026-09-06', '2026-10-06')], '2026-10-20')).toBe('Venceu em 06/10/2026');
  });
});
