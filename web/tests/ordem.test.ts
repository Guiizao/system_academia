import { describe, it, expect } from 'vitest';
import { mover, podeMover } from '../src/dominio/ordem';

describe('mover', () => {
  it('sobe e desce um item', () => {
    expect(mover(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(mover(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('nao mexe na lista original', () => {
    const lista = ['a', 'b', 'c'];
    mover(lista, 0, 2);
    expect(lista).toEqual(['a', 'b', 'c']);
  });

  it('fora dos limites devolve a lista igual, sem perder item', () => {
    expect(mover(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(mover(['a', 'b'], 1, 9)).toEqual(['a', 'b']);
    expect(mover(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('podeMover', () => {
  it('desliga a seta nas pontas', () => {
    expect(podeMover(0, 3, -1)).toBe(false);
    expect(podeMover(0, 3, 1)).toBe(true);
    expect(podeMover(2, 3, 1)).toBe(false);
    expect(podeMover(2, 3, -1)).toBe(true);
  });
});
