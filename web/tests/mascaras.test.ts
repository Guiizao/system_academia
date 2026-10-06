import { describe, it, expect } from 'vitest';
import { mascararTelefone, mascararCPF, soDigitos } from '../src/dominio/mascaras';

describe('mascararTelefone', () => {
  it('vai formatando enquanto digita', () => {
    expect(mascararTelefone('1')).toBe('(1');
    expect(mascararTelefone('11')).toBe('(11) ');
    expect(mascararTelefone('119')).toBe('(11) 9');
    expect(mascararTelefone('11998')).toBe('(11) 9 98');
    expect(mascararTelefone('11998887')).toBe('(11) 9 9888-7');
    expect(mascararTelefone('11998887777')).toBe('(11) 9 9888-7777');
  });

  it('fixo de 10 digitos tem o proprio formato', () => {
    expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
  });

  it('apagar funciona: texto ja mascarado volta igual', () => {
    expect(mascararTelefone('(11) 9 9888-7777')).toBe('(11) 9 9888-7777');
    expect(mascararTelefone('(11) ')).toBe('(11) ');
  });

  it('colar com +55 ou com texto tira o que nao e numero', () => {
    expect(mascararTelefone('+55 (11) 99888-7777')).toBe('(11) 9 9888-7777');
    expect(mascararTelefone('5511998887777')).toBe('(11) 9 9888-7777');
    expect(mascararTelefone('whatsapp: 11 99888-7777')).toBe('(11) 9 9888-7777');
  });

  it('para em 11 digitos', () => {
    expect(mascararTelefone('119988877771234')).toBe('(11) 9 9888-7777');
  });

  it('vazio continua vazio (o campo nao pode comecar com parentese sozinho)', () => {
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('abc')).toBe('');
  });
});

describe('mascararCPF', () => {
  it('vai formatando enquanto digita', () => {
    expect(mascararCPF('123')).toBe('123');
    expect(mascararCPF('1234')).toBe('123.4');
    expect(mascararCPF('123456789')).toBe('123.456.789');
    expect(mascararCPF('12345678901')).toBe('123.456.789-01');
  });

  it('para em 11 digitos e ignora o resto', () => {
    expect(mascararCPF('123.456.789-0123')).toBe('123.456.789-01');
  });

  it('vazio continua vazio', () => expect(mascararCPF('')).toBe(''));
});

describe('soDigitos', () => {
  it('serve para mandar ao servidor sem pontuacao', () => {
    expect(soDigitos('(11) 9 9888-7777')).toBe('11998887777');
    expect(soDigitos('123.456.789-01')).toBe('12345678901');
  });
});
