import { describe, it, expect } from 'vitest';
import { escalaDeBarras, mesCurto, variacaoTexto } from '../src/dominio/grafico';

describe('escalaDeBarras', () => {
  it('a maior barra ocupa tudo e as outras sao proporcionais', () => {
    const e = escalaDeBarras([50, 100, 25]);
    expect(e.maximo).toBe(100);
    expect(e.pct(100)).toBe(100);
    expect(e.pct(50)).toBe(50);
    expect(e.pct(25)).toBe(25);
  });

  it('valor zero nao vira barra invisivel de altura negativa', () => {
    expect(escalaDeBarras([0, 100]).pct(0)).toBe(0);
  });

  it('tudo zero nao divide por zero', () => {
    const e = escalaDeBarras([0, 0]);
    expect(e.maximo).toBe(0);
    expect(e.pct(0)).toBe(0);
  });

  it('lista vazia tambem nao quebra', () => {
    expect(escalaDeBarras([]).pct(10)).toBe(0);
  });

  it('valor pequeno ainda aparece (minimo visivel)', () => {
    // 1 de 10000 daria 0,01% e sumiria: a barra tem um piso para existir na tela
    expect(escalaDeBarras([1, 10000]).pct(1)).toBeGreaterThanOrEqual(1.5);
  });
});

describe('mesCurto', () => {
  it('vira rotulo de eixo', () => {
    expect(mesCurto('2026-10')).toBe('out');
    expect(mesCurto('2026-01')).toBe('jan');
  });

  it('janeiro mostra o ano, para a serie nao confundir dois anos', () => {
    expect(mesCurto('2026-01', true)).toBe('jan/26');
  });
});

describe('variacaoTexto', () => {
  it('fala de subida, descida e empate', () => {
    expect(variacaoTexto(20)).toMatchObject({ texto: '+20% vs. mês anterior', tom: 'ok' });
    expect(variacaoTexto(-15)).toMatchObject({ texto: '-15% vs. mês anterior', tom: 'danger' });
    expect(variacaoTexto(0)).toMatchObject({ texto: 'igual ao mês anterior', tom: 'mudo' });
  });

  it('sem mes anterior nao inventa comparacao', () => {
    expect(variacaoTexto(null)).toBeNull();
  });
});
