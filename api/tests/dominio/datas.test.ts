import { describe, it, expect } from 'vitest';
import { adicionarMeses, ultimoDiaDoMes, diffDias, maiorData } from '../../src/dominio/datas.js';

describe('ultimoDiaDoMes', () => {
  it('conhece meses curtos e bissextos', () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 12)).toBe(31);
  });
});

describe('adicionarMeses', () => {
  it('caso simples', () => {
    expect(adicionarMeses('2026-09-10', 1, 10)).toBe('2026-10-10');
    expect(adicionarMeses('2026-09-10', 3, 10)).toBe('2026-12-10');
    expect(adicionarMeses('2026-09-10', 12, 10)).toBe('2027-09-10');
  });

  it('vira o ano', () => {
    expect(adicionarMeses('2026-11-15', 3, 15)).toBe('2027-02-15');
  });

  it('encurta quando o mes destino nao tem o dia ancora', () => {
    expect(adicionarMeses('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(adicionarMeses('2028-01-31', 1, 31)).toBe('2028-02-29');
    expect(adicionarMeses('2026-03-31', 1, 31)).toBe('2026-04-30');
  });

  it('RESTAURA o dia ancora quando o mes destino comporta', () => {
    expect(adicionarMeses('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(adicionarMeses('2026-04-30', 1, 31)).toBe('2026-05-31');
  });
});

describe('diffDias', () => {
  it('conta dias entre datas', () => {
    expect(diffDias('2026-09-08', '2026-09-13')).toBe(5);
    expect(diffDias('2026-09-13', '2026-09-08')).toBe(-5);
    expect(diffDias('2026-09-08', '2026-09-08')).toBe(0);
  });

  it('atravessa virada de mes e ano', () => {
    expect(diffDias('2026-12-30', '2027-01-02')).toBe(3);
  });
});

describe('maiorData', () => {
  it('devolve a mais recente', () => {
    expect(maiorData('2026-09-10', '2026-09-08')).toBe('2026-09-10');
    expect(maiorData('2026-09-08', '2026-09-20')).toBe('2026-09-20');
    expect(maiorData('2026-09-08', '2026-09-08')).toBe('2026-09-08');
  });
});
