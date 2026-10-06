import { describe, it, expect } from 'vitest';
import { calcularRenovacao } from '../../src/dominio/renovacao.js';

/** Diária: vale o dia escolhido e acaba nele. Não tem âncora nem mês. */
describe('diaria', () => {
  it('uma diária vale só o dia', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05',
      duracaoMeses: 0, duracaoDias: 1,
    });
    expect(r).toEqual({ dataInicio: '2026-10-05', dataFim: '2026-10-05', diaAncora: 5 });
  });

  it('tres diarias valem tres dias corridos', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05',
      duracaoMeses: 0, duracaoDias: 3,
    });
    expect(r.dataFim).toBe('2026-10-07');
  });

  it('atravessa a virada do mes sem se perder', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-30',
      duracaoMeses: 0, duracaoDias: 3,
    });
    expect(r.dataFim).toBe('2026-11-01');
  });

  it('a pessoa escolhe o dia: a diaria comeca nele, nao no pagamento', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05',
      duracaoMeses: 0, duracaoDias: 1, dataInicioEscolhida: '2026-10-12',
    });
    expect(r).toMatchObject({ dataInicio: '2026-10-12', dataFim: '2026-10-12' });
  });

  it('diaria nao emenda no plano anterior (nao e renovacao)', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-12-31', diaAncoraAtual: 31, dataPagamento: '2026-10-05',
      duracaoMeses: 0, duracaoDias: 1,
    });
    expect(r.dataInicio).toBe('2026-10-05');
  });

  it('numero de dias invalido e recusado', () => {
    const base = { dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05', duracaoMeses: 0 };
    expect(() => calcularRenovacao({ ...base, duracaoDias: 0 })).toThrow(/Duração/);
    expect(() => calcularRenovacao({ ...base, duracaoDias: 1.5 })).toThrow(/Duração/);
  });
});

describe('vencimento escolhido na mao', () => {
  it('manda em cima da conta automatica', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05',
      duracaoMeses: 1, dataFimManual: '2026-11-20',
    });
    expect(r).toEqual({ dataInicio: '2026-10-05', dataFim: '2026-11-20', diaAncora: 20 });
  });

  it('serve tambem para diaria (cortesia de uma semana, por exemplo)', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05',
      duracaoMeses: 0, duracaoDias: 1, dataFimManual: '2026-10-12',
    });
    expect(r.dataFim).toBe('2026-10-12');
  });

  it('vencimento antes do inicio nao passa', () => {
    expect(() => calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null, dataPagamento: '2026-10-05',
      duracaoMeses: 1, dataFimManual: '2026-10-01',
    })).toThrow(/antes/i);
  });
});

describe('mensalidade continua como era', () => {
  it('pagamento em dia emenda no vencimento e guarda a ancora', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-10-10', diaAncoraAtual: 10, dataPagamento: '2026-10-08', duracaoMeses: 1,
    });
    expect(r).toEqual({ dataInicio: '2026-10-10', dataFim: '2026-11-10', diaAncora: 10 });
  });
});
