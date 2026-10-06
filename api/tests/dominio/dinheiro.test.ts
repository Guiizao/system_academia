import { describe, it, expect } from 'vitest';
import { reaisParaCentavos, centavosParaReais, formatarBRL } from '../../src/dominio/dinheiro.js';

describe('dinheiro', () => {
  it('converte reais para centavos sem erro de float', () => {
    expect(reaisParaCentavos(139)).toBe(13900);
    expect(reaisParaCentavos(89.9)).toBe(8990);
    expect(reaisParaCentavos(0.1)).toBe(10);
    expect(reaisParaCentavos(1.005)).toBe(101);
  });

  it('converte centavos para reais', () => {
    expect(centavosParaReais(13900)).toBe(139);
    expect(centavosParaReais(8990)).toBe(89.9);
  });

  it('formata em BRL', () => {
    expect(formatarBRL(13900)).toBe('R$ 139,00');
    expect(formatarBRL(8990)).toBe('R$ 89,90');
    expect(formatarBRL(0)).toBe('R$ 0,00');
    expect(formatarBRL(118800)).toBe('R$ 1.188,00');
  });

  it('rejeita centavos nao inteiros', () => {
    expect(() => formatarBRL(139.5)).toThrow();
  });
});
