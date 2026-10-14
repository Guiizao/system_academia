import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contraste } from '../src/dominio/cores';
import { TEMAS, temaValido, type IdTema } from '../src/dominio/temas';

const CSS = readFileSync(join(process.cwd(), 'src/estilos/tokens.css'), 'utf8');

/** Variaveis declaradas no bloco de um tema (o escuro mora no :root). */
function variaveis(id: IdTema): Map<string, string> {
  const alvo = id === 'escuro' ? ":root, [data-tema='escuro']" : `[data-tema='${id}']`;
  const i = CSS.indexOf(alvo);
  expect(i, `tokens.css nao tem o bloco ${alvo}`).toBeGreaterThan(-1);
  const bloco = CSS.slice(CSS.indexOf('{', i) + 1, CSS.indexOf('}', i));
  const vars = new Map<string, string>();
  for (const linha of bloco.split(';')) {
    const m = linha.match(/(--[\w-]+)\s*:\s*([^;]+)/);
    if (m) vars.set(m[1], m[2].trim());
  }
  return vars;
}

const comCor = TEMAS.filter((t) => t.id !== 'auto');

describe('contraste', () => {
  it('mede a diferenca entre duas cores', () => {
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
    expect(contraste('#E8EAEE', '#111318')).toBeGreaterThan(4.5);
  });

  it('entende espacos e letras minusculas', () => {
    expect(contraste(' #ffffff ', '#000')).toBeCloseTo(21, 1);
  });
});

describe('temas', () => {
  it('sao tres escuros, dois claros e o automatico', () => {
    expect(TEMAS.map((t) => t.id)).toEqual(['escuro', 'cinza', 'meianoite', 'claro', 'areia', 'auto']);
  });

  it('todo tema declara exatamente as mesmas variaveis do escuro', () => {
    const base = [...variaveis('escuro').keys()].sort();
    for (const t of comCor) {
      expect([...variaveis(t.id).keys()].sort(), `tema ${t.id}`).toEqual(base);
    }
  });

  it.each(comCor.map((t) => t.id))('o tema %s passa no contraste AA', (id) => {
    const v = variaveis(id);
    const par = (a: string, b: string) => contraste(v.get(a)!, v.get(b)!);
    expect(par('--text', '--bg'), 'texto sobre o fundo').toBeGreaterThanOrEqual(4.5);
    expect(par('--text', '--surface'), 'texto sobre o cartao').toBeGreaterThanOrEqual(4.5);
    expect(par('--muted', '--surface'), 'texto secundario sobre o cartao').toBeGreaterThanOrEqual(4.5);
    expect(par('--accent-texto', '--accent'), 'texto do botao azul').toBeGreaterThanOrEqual(4.5);
    expect(par('--text', '--surface-2'), 'texto sobre campo').toBeGreaterThanOrEqual(4.5);
  });

  it('a amostra do seletor usa as cores de verdade do tema', () => {
    for (const t of comCor) {
      const v = variaveis(t.id);
      expect(t.amostra, `tema ${t.id}`).toEqual([v.get('--bg'), v.get('--surface-2'), v.get('--accent')]);
    }
  });

  it('temaValido aceita so o que existe', () => {
    expect(temaValido('meianoite')).toBe(true);
    expect(temaValido('areia')).toBe(true);
    expect(temaValido('marrom')).toBe(false);   // removido a pedido do dono
    expect(temaValido('auto')).toBe(true);
    expect(temaValido('neon')).toBe(false);
    expect(temaValido(null)).toBe(false);
  });
});

describe('texto de status sobre a faixa de aviso', () => {
  /*
   * Amarelo, verde e vermelho aparecem como TEXTO em cima da propria faixa
   * clarinha (selo "Vencendo", aviso de restricao, faixa da ficha). Em 14/10
   * o amarelo do tema Claro dava 3,5:1 ali -- abaixo dos 4,5:1 de texto
   * pequeno. Este teste compoe a faixa sobre o cartao e mede de verdade.
   */
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const rgbDe = (cor: string): [number, number, number] => {
    const h = cor.trim().replace('#', '');
    const cheio = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as [number, number, number];
  };
  /** pinta a faixa semitransparente por cima do cartao e devolve a cor final */
  const sobre = (faixa: string, fundo: string): string => {
    const m = faixa.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
    if (!m) return faixa;
    const a = Number(m[4]);
    const base = rgbDe(fundo);
    return '#' + [1, 2, 3].map((k, i) => hex(Number(m[k]) * a + base[i] * (1 - a))).join('');
  };

  for (const tema of comCor) {
    it(`${tema.nome}: amarelo, verde e vermelho legiveis na faixa e no cartao`, () => {
      const v = variaveis(tema.id);
      const cartao = v.get('--surface')!;
      for (const status of ['warn', 'ok', 'danger']) {
        const cor = v.get(`--${status}`)!;
        const faixa = sobre(v.get(`--${status}-suave`)!, cartao);
        expect(contraste(cor, cartao), `${status} no cartao`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cor, faixa), `${status} na faixa`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
