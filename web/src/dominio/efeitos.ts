/**
 * Efeitos opcionais da interface.
 *
 * Separado do tema de propósito: tema é a cor, efeito é o movimento. Quem
 * trabalha o dia inteiro no sistema pode querer tudo quieto; quem mostra a
 * academia para um aluno novo pode querer a tela mais viva.
 *
 * Cada efeito vira uma classe `ef-<id>` no <html> e o resto é CSS -- sem
 * biblioteca de animação e sem peso no bundle. Todos respeitam
 * `prefers-reduced-motion`: com ele ligado no aparelho, nada se mexe.
 */

export type IdEfeito = 'relevo' | 'foco-vivo' | 'cascata' | 'respiro' | 'troca-de-tela';

export interface Efeito {
  id: IdEfeito;
  nome: string;
  /** o que a pessoa vai ver, em uma linha */
  descricao: string;
  /** ligado numa instalação nova */
  padrao: boolean;
}

export const EFEITOS: readonly Efeito[] = [
  {
    id: 'relevo',
    nome: 'Cartões com relevo',
    descricao: 'O cartão sob o cursor sobe um pouco e ganha sombra.',
    padrao: true,
  },
  {
    id: 'foco-vivo',
    nome: 'Realce do que está em foco',
    descricao: 'A linha sob o cursor e o campo em edição ficam destacados.',
    padrao: true,
  },
  {
    id: 'cascata',
    nome: 'Listas em cascata',
    descricao: 'Os itens da lista aparecem um após o outro, não todos de uma vez.',
    padrao: true,
  },
  {
    id: 'respiro',
    nome: 'Fundo com respiro',
    descricao: 'Um brilho muito lento no fundo, para a tela não ficar parada.',
    padrao: false,
  },
  {
    id: 'troca-de-tela',
    nome: 'Transição entre telas',
    descricao: 'Ao trocar de tela, a nova entra deslizando em vez de piscar.',
    padrao: true,
  },
] as const;

export function efeitoValido(v: unknown): v is IdEfeito {
  return typeof v === 'string' && EFEITOS.some((e) => e.id === v);
}

/** Os que vêm ligados numa instalação nova. */
export function efeitosPadrao(): IdEfeito[] {
  return EFEITOS.filter((e) => e.padrao).map((e) => e.id);
}

/**
 * Limpa o que veio do armazenamento: descarta id desconhecido (versão antiga
 * ou mexida na mão), tira repetido e devolve sempre na ordem do catálogo,
 * para a classe do <html> não depender da ordem em que foi clicado.
 */
export function normalizarEfeitos(v: unknown): IdEfeito[] {
  if (!Array.isArray(v)) return efeitosPadrao();
  const escolhidos = new Set(v.filter(efeitoValido));
  return EFEITOS.filter((e) => escolhidos.has(e.id)).map((e) => e.id);
}

/** Liga ou desliga um efeito, devolvendo a lista nova (sem mexer na recebida). */
export function alternar(atuais: readonly IdEfeito[], id: IdEfeito): IdEfeito[] {
  const tem = atuais.includes(id);
  return normalizarEfeitos(tem ? atuais.filter((e) => e !== id) : [...atuais, id]);
}

/** Classes para o <html>: `ef-relevo ef-cascata`… */
export function classesDe(efeitos: readonly IdEfeito[]): string {
  return efeitos.map((e) => `ef-${e}`).join(' ');
}
