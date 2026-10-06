import { describe, it, expect } from 'vitest';
import { montarBrCode, crc16 } from '../../src/dominio/pix.js';

describe('crc16', () => {
  it('calcula CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('montarBrCode', () => {
  const base = {
    chave: 'darkfisic@email.com',
    nomeRecebedor: 'DARK FISIC ACADEMIA',
    cidade: 'SAO PAULO',
  };

  it('comeca com payload format indicator', () => {
    expect(montarBrCode(base).startsWith('000201')).toBe(true);
  });

  it('termina com o campo CRC de 4 digitos hex', () => {
    const p = montarBrCode(base);
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('o CRC confere com o proprio payload', () => {
    const p = montarBrCode(base);
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });

  it('inclui a chave pix no merchant account information', () => {
    expect(montarBrCode(base)).toContain('BR.GOV.BCB.PIX');
    expect(montarBrCode(base)).toContain('darkfisic@email.com');
  });

  it('inclui valor formatado com duas casas quando informado', () => {
    expect(montarBrCode({ ...base, valorCentavos: 13900 })).toContain('5406139.00');
    expect(montarBrCode({ ...base, valorCentavos: 8990 })).toContain('540589.90');
  });

  it('omite o campo de valor quando nao informado', () => {
    expect(montarBrCode(base)).not.toMatch(/54\d{2}/);
  });

  it('trunca e higieniza nome e cidade', () => {
    const p = montarBrCode({
      ...base,
      nomeRecebedor: 'Academia Acao & Saude Ltda com nome muito muito longo',
      cidade: 'Sao Jose dos Campos',
    });
    // campo 60 (Merchant City) do BR Code e limitado a 15 caracteres,
    // e o 59 (Merchant Name) a 25 -- truncar e o comportamento correto
    expect(p).toContain('6015SAO JOSE DOS CA');
    expect(p).toContain('5925ACADEMIA ACAO SAUDE LTDA');
    expect(p).not.toMatch(/&/);
  });

  it('usa txid informado e *** como padrao', () => {
    expect(montarBrCode({ ...base, txid: 'COB1234' })).toContain('COB1234');
    expect(montarBrCode(base)).toContain('0503***');
  });

  it('rejeita chave vazia', () => {
    expect(() => montarBrCode({ ...base, chave: '' })).toThrow('Chave Pix');
  });

  it('rejeita valor nao inteiro ou zero', () => {
    expect(() => montarBrCode({ ...base, valorCentavos: 139.5 })).toThrow();
    expect(() => montarBrCode({ ...base, valorCentavos: 0 })).toThrow();
  });
});
