import { describe, it, expect } from 'vitest';
import { calcularRenovacao } from '../../src/dominio/renovacao.js';

describe('calcularRenovacao', () => {
  it('primeira matricula ancora no dia do pagamento', () => {
    expect(calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null,
      dataPagamento: '2026-09-10', duracaoMeses: 1,
    })).toEqual({ dataInicio: '2026-09-10', dataFim: '2026-10-10', diaAncora: 10 });
  });

  it('pagamento ADIANTADO conta do vencimento antigo', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-08', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-09-10');
    expect(r.dataFim).toBe('2026-10-10');
    expect(r.diaAncora).toBe(10);
  });

  it('pagamento EM DIA conta do vencimento', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-10', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-09-10');
    expect(r.dataFim).toBe('2026-10-10');
  });

  it('pagamento ATRASADO conta da data do pagamento E reancora', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-20', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-09-20');
    expect(r.dataFim).toBe('2026-10-20');
    expect(r.diaAncora).toBe(20);
  });

  it('atrasado em mes curto nao entrega periodo mutilado', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-02-28', diaAncoraAtual: 31,
      dataPagamento: '2026-03-10', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-03-10');
    expect(r.dataFim).toBe('2026-04-10');
    expect(r.diaAncora).toBe(10);
  });

  it('adiantado preserva a ancora e restaura o dia 31', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-02-28', diaAncoraAtual: 31,
      dataPagamento: '2026-02-20', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-02-28');
    expect(r.dataFim).toBe('2026-03-31');
    expect(r.diaAncora).toBe(31);
  });

  it('plano trimestral e anual', () => {
    expect(calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-10', duracaoMeses: 3,
    }).dataFim).toBe('2026-12-10');
    expect(calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-10', duracaoMeses: 12,
    }).dataFim).toBe('2027-09-10');
  });
});
