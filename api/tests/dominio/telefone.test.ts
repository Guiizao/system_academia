import { describe, it, expect } from 'vitest';
import { normalizarTelefone, telefoneValido } from '../../src/dominio/telefone.js';

describe('telefone', () => {
  it('normaliza formatos brasileiros comuns para E.164', () => {
    expect(normalizarTelefone('(11) 9 8000-1111')).toBe('+5511980001111');
    expect(normalizarTelefone('11980001111')).toBe('+5511980001111');
    expect(normalizarTelefone('+55 11 98000-1111')).toBe('+5511980001111');
    expect(normalizarTelefone('011 98000 1111')).toBe('+5511980001111');
  });

  it('aceita fixo de 8 digitos', () => {
    expect(normalizarTelefone('(11) 3333-4444')).toBe('+551133334444');
  });

  it('rejeita numero curto demais', () => {
    expect(() => normalizarTelefone('99999')).toThrow('Telefone inválido');
    expect(telefoneValido('99999')).toBe(false);
  });

  it('rejeita DDD invalido', () => {
    expect(() => normalizarTelefone('(00) 98000-1111')).toThrow('Telefone inválido');
  });
});
