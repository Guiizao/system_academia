import { describe, it, expect } from 'vitest';
import {
  TAGS_PADRAO, normalizarRestricao, adicionarRestricao, alternarRestricao, ehTagPadrao, LIMITE_RESTRICOES,
} from '../src/dominio/restricoes';

describe('normalizarRestricao', () => {
  it('tira acento, espaco sobrando e deixa minusculo', () => {
    expect(normalizarRestricao('  Hérnia de Disco ')).toBe('hernia de disco');
    expect(normalizarRestricao('JOELHO')).toBe('joelho');
    expect(normalizarRestricao('dor   no   ombro')).toBe('dor no ombro');
  });

  it('corta o que for longo demais e recusa vazio', () => {
    expect(normalizarRestricao('a'.repeat(60))).toHaveLength(40);
    expect(normalizarRestricao('   ')).toBe('');
    expect(normalizarRestricao('...')).toBe('');
  });
});

describe('adicionarRestricao', () => {
  it('acrescenta o que a pessoa escreveu', () => {
    expect(adicionarRestricao(['joelho'], 'Bursite no Ombro')).toEqual(['joelho', 'bursite no ombro']);
  });

  it('nao repete o que ja esta na lista, mesmo escrito diferente', () => {
    expect(adicionarRestricao(['joelho'], 'Joelho')).toEqual(['joelho']);
    expect(adicionarRestricao(['hernia'], ' HÉRNIA ')).toEqual(['hernia']);
  });

  it('texto vazio nao entra', () => {
    expect(adicionarRestricao(['joelho'], '   ')).toEqual(['joelho']);
  });

  it('respeita o limite de restricoes', () => {
    const cheia = Array.from({ length: LIMITE_RESTRICOES }, (_, i) => `r${i}`);
    expect(adicionarRestricao(cheia, 'mais uma')).toEqual(cheia);
  });

  it('nao altera a lista original', () => {
    const antes = ['joelho'];
    adicionarRestricao(antes, 'ombro');
    expect(antes).toEqual(['joelho']);
  });
});

describe('alternarRestricao', () => {
  it('marca e desmarca a tag', () => {
    expect(alternarRestricao([], 'joelho')).toEqual(['joelho']);
    expect(alternarRestricao(['joelho', 'ombro'], 'joelho')).toEqual(['ombro']);
  });
});

describe('ehTagPadrao', () => {
  it('diz quais filtram exercicio na ficha', () => {
    expect(TAGS_PADRAO).toContain('joelho');
    expect(ehTagPadrao('joelho')).toBe(true);
    expect(ehTagPadrao('bursite no ombro')).toBe(false);
  });
});
