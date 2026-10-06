/**
 * Conta dos graficos. Fica aqui, longe do desenho, porque e o que pode estar
 * errado sem ninguem perceber -- barra proporcional ao valor errado continua
 * bonita na tela.
 */

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Piso para a barra existir: sem isso um valor pequeno vira um fio invisivel. */
const MINIMO_VISIVEL = 1.5;

export interface EscalaBarras {
  maximo: number;
  /** Altura (ou largura) da barra, de 0 a 100. */
  pct: (valor: number) => number;
}

export function escalaDeBarras(valores: readonly number[]): EscalaBarras {
  const maximo = valores.length ? Math.max(...valores) : 0;
  return {
    maximo,
    pct: (valor) => {
      if (!maximo || valor <= 0) return 0;
      return Math.max(MINIMO_VISIVEL, (valor / maximo) * 100);
    },
  };
}

/** 'AAAA-MM' -> 'out'. Em janeiro vale mostrar o ano, para a serie nao enganar. */
export function mesCurto(mes: string, comAno = false): string {
  const nome = MESES_CURTOS[Number(mes.slice(5, 7)) - 1] ?? mes;
  return comAno ? `${nome}/${mes.slice(2, 4)}` : nome;
}

export interface Variacao { texto: string; tom: 'ok' | 'danger' | 'mudo' }

export function variacaoTexto(pct: number | null): Variacao | null {
  if (pct === null) return null;
  if (pct === 0) return { texto: 'igual ao mês anterior', tom: 'mudo' };
  return {
    texto: `${pct > 0 ? '+' : ''}${pct}% vs. mês anterior`,
    tom: pct > 0 ? 'ok' : 'danger',
  };
}
