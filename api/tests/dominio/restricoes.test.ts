import { describe, it, expect } from 'vitest';
import { normalizarRestricoes, LIMITE_RESTRICOES } from '../../src/dominio/restricoes.js';

describe('normalizarRestricoes', () => {
  it('guarda sempre na mesma forma, para a ficha conseguir comparar', () => {
    expect(normalizarRestricoes(['JOELHO', ' Hérnia de Disco '])).toEqual(['joelho', 'hernia de disco']);
  });

  it('tira repetido e vazio', () => {
    expect(normalizarRestricoes(['joelho', 'Joelho', '  ', 'ombro'])).toEqual(['joelho', 'ombro']);
  });

  it('corta texto longo e respeita o limite da lista', () => {
    expect(normalizarRestricoes(['a'.repeat(80)])[0]).toHaveLength(40);
    const muitas = Array.from({ length: LIMITE_RESTRICOES + 5 }, (_, i) => `restricao ${i}`);
    expect(normalizarRestricoes(muitas)).toHaveLength(LIMITE_RESTRICOES);
  });

  it('nao deixa passar nada que nao seja texto', () => {
    expect(normalizarRestricoes(['joelho', 123 as unknown as string, null as unknown as string])).toEqual(['joelho']);
  });
});
