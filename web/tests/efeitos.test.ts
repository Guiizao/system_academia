import { describe, it, expect } from 'vitest';
import {
  EFEITOS, alternar, classesDe, efeitoValido, efeitosPadrao, normalizarEfeitos,
} from '../src/dominio/efeitos';

describe('catalogo', () => {
  it('sao exatamente 5 efeitos, com id unico', () => {
    expect(EFEITOS).toHaveLength(5);
    expect(new Set(EFEITOS.map((e) => e.id)).size).toBe(5);
  });

  it('todo efeito tem nome e explicacao em uma linha', () => {
    for (const e of EFEITOS) {
      expect(e.nome.length).toBeGreaterThan(3);
      expect(e.descricao.length).toBeGreaterThan(10);
      expect(e.descricao).not.toContain('\n');
    }
  });
});

describe('normalizarEfeitos', () => {
  it('sem nada guardado, usa o padrao', () => {
    expect(normalizarEfeitos(null)).toEqual(efeitosPadrao());
    expect(normalizarEfeitos('escuro')).toEqual(efeitosPadrao());
  });

  it('lista vazia e uma escolha legitima: tudo desligado', () => {
    expect(normalizarEfeitos([])).toEqual([]);
  });

  it('descarta id desconhecido e repetido', () => {
    expect(normalizarEfeitos(['relevo', 'inventado', 'relevo'])).toEqual(['relevo']);
  });

  it('devolve sempre na ordem do catalogo, nao na ordem do clique', () => {
    expect(normalizarEfeitos(['cascata', 'relevo'])).toEqual(['relevo', 'cascata']);
  });
});

describe('alternar', () => {
  it('liga o que estava desligado e desliga o que estava ligado', () => {
    expect(alternar([], 'relevo')).toEqual(['relevo']);
    expect(alternar(['relevo'], 'relevo')).toEqual([]);
  });

  it('nao mexe na lista recebida', () => {
    const antes: ReturnType<typeof efeitosPadrao> = ['relevo'];
    alternar(antes, 'cascata');
    expect(antes).toEqual(['relevo']);
  });
});

describe('classesDe', () => {
  it('monta as classes do <html>', () => {
    expect(classesDe(['relevo', 'cascata'])).toBe('ef-relevo ef-cascata');
    expect(classesDe([])).toBe('');
  });
});

describe('efeitoValido', () => {
  it('aceita so os ids do catalogo', () => {
    expect(efeitoValido('respiro')).toBe(true);
    expect(efeitoValido('neon')).toBe(false);
    expect(efeitoValido(7)).toBe(false);
  });
});
