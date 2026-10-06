import { describe, it, expect } from 'vitest';
import {
  EFEITOS, alternar, classesDe, classesDoHtml, efeitoValido,
  efeitosDoGrupo, efeitosPadrao, normalizarEfeitos,
} from '../src/dominio/efeitos';

describe('catalogo', () => {
  it('sao dez efeitos, com id unico', () => {
    expect(EFEITOS).toHaveLength(10);
    expect(new Set(EFEITOS.map((e) => e.id)).size).toBe(10);
  });

  it('cinco de movimento e cinco visuais', () => {
    expect(efeitosDoGrupo('movimento')).toHaveLength(5);
    expect(efeitosDoGrupo('visual')).toHaveLength(5);
  });

  it('nenhum efeito visual vem ligado: quem quiser, liga', () => {
    for (const e of efeitosDoGrupo('visual')) {
      expect(e.padrao, `${e.id} nao pode vir ligado`).toBe(false);
    }
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
    expect(efeitoValido('neon')).toBe(true);
    expect(efeitoValido('inventado')).toBe(false);
    expect(efeitoValido(7)).toBe(false);
  });
});

describe('ligar e DESLIGAR as classes do <html>', () => {
  /*
   * O bug que o Guilherme viu: desmarcar nao desligava.
   *
   * A versao antiga percorria `html.classList` com forEach removendo durante
   * a volta. `classList` e uma lista VIVA e o forEach anda por indice, entao
   * cada remocao encurtava a lista debaixo do laco e pulava o item seguinte.
   * Com quatro efeitos ligados, dois continuavam colados no <html>.
   */
  it('desligar TODOS nao deixa nenhuma classe para tras', () => {
    const ligado = classesDoHtml(['tema-escuro'], ['relevo', 'foco-vivo', 'cascata', 'troca-de-tela', 'neon']);
    expect(ligado.filter((c) => c.startsWith('ef-'))).toHaveLength(5);
    expect(classesDoHtml(ligado, []).filter((c) => c.startsWith('ef-'))).toEqual([]);
  });

  it('o laco antigo pulava um item sim, um nao: aqui nao sobra nenhum', () => {
    // reproduz a lista exata que falhava: quatro efeitos seguidos
    const antes = ['tema-escuro', 'ef-relevo', 'ef-foco-vivo', 'ef-cascata', 'ef-troca-de-tela'];
    expect(classesDoHtml(antes, [])).toEqual(['tema-escuro']);
  });

  it('trocar a escolha troca as classes, sem acumular', () => {
    const antes = classesDoHtml([], ['relevo', 'cascata', 'respiro']);
    expect(classesDoHtml(antes, ['neon'])).toEqual(['ef-neon']);
  });

  it('nao encosta nas classes que nao sao de efeito', () => {
    const antes = classesDoHtml(['tema-escuro', 'com-barra-janela'], ['relevo', 'grade']);
    const depois = classesDoHtml(antes, []);
    expect(depois).toEqual(['tema-escuro', 'com-barra-janela']);
  });
});
