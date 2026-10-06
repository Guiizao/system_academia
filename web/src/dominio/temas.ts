/**
 * Paletas da interface. Cada uma e um bloco [data-tema] no tokens.css e
 * precisa declarar as MESMAS variaveis -- o teste de tema cobra isso, e
 * tambem o contraste minimo de leitura (AA).
 *
 * As amostras sao as cores de verdade do tema: o seletor mostra o que vem.
 */
export type IdTema = 'escuro' | 'cinza' | 'meianoite' | 'claro' | 'areia' | 'auto';

export interface Tema {
  id: IdTema;
  nome: string;
  descricao: string;
  /** fundo, superficie e azul de acao -- nessa ordem. */
  amostra: [string, string, string];
}

export const TEMAS: readonly Tema[] = [
  // três escuros
  { id: 'escuro', nome: 'Grafite', descricao: 'O padrão: escuro neutro, azul da marca.', amostra: ['#111318', '#20242C', '#5B85F5'] },
  { id: 'cinza', nome: 'Cinza', descricao: 'Escuro mais suave, cansa menos à noite.', amostra: ['#1E2127', '#2C313A', '#6C94F7'] },
  { id: 'meianoite', nome: 'Meia-noite', descricao: 'Azul profundo, com verde-água na ação.', amostra: ['#0E1522', '#1C2740', '#49C7CE'] },
  // dois claros
  { id: 'claro', nome: 'Claro', descricao: 'Branco limpo, para a recepção com luz forte.', amostra: ['#F3F4F6', '#F1F3F6', '#2F62E0'] },
  { id: 'areia', nome: 'Areia', descricao: 'Claro quente, menos estourado que o branco.', amostra: ['#F6F2EA', '#F1EBE0', '#A8551E'] },
  { id: 'auto', nome: 'Automático', descricao: 'Acompanha o aparelho: claro de dia, grafite à noite.', amostra: ['#111318', '#F3F4F6', '#5B85F5'] },
] as const;

export function temaValido(v: unknown): v is IdTema {
  return typeof v === 'string' && TEMAS.some((t) => t.id === v);
}
