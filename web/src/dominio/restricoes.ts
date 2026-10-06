/**
 * Restricoes medicas do aluno.
 *
 * As tags padrao sao as que o sistema sabe cruzar com a biblioteca de
 * exercicios: marcar "joelho" tira agachamento da ficha. Texto livre serve
 * para o que a lista nao cobre ("bursite no ombro") -- fica registrado e
 * aparece para o professor, mas nao filtra exercicio sozinho. A tela avisa isso.
 */
export const TAGS_PADRAO = [
  'joelho', 'ombro', 'lombar', 'cervical', 'punho', 'tornozelo',
  'quadril', 'hipertensao', 'cardiaco', 'gestante', 'hernia', 'diabetes',
] as const;

export const LIMITE_RESTRICOES = 20;
const LIMITE_TEXTO = 40;

/** Mesma forma do que o servidor compara: sem acento, minusculo, sem espaco duplo. */
export function normalizarRestricao(texto: string): string {
  return (texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITE_TEXTO);
}

export function ehTagPadrao(restricao: string): boolean {
  return (TAGS_PADRAO as readonly string[]).includes(restricao);
}

export function adicionarRestricao(atuais: readonly string[], texto: string): string[] {
  const nova = normalizarRestricao(texto);
  if (!nova || atuais.includes(nova) || atuais.length >= LIMITE_RESTRICOES) return [...atuais];
  return [...atuais, nova];
}

export function alternarRestricao(atuais: readonly string[], tag: string): string[] {
  return atuais.includes(tag) ? atuais.filter((x) => x !== tag) : [...atuais, tag];
}
