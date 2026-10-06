/**
 * Restricoes medicas gravadas sempre na mesma forma: sem acento, minusculas,
 * sem espaco duplo. A montagem da ficha compara texto com texto -- "Joelho"
 * digitado a mao tem que bater com a tag "joelho" da biblioteca de exercicios.
 *
 * O limite existe porque isso vem de fora: campo livre sem teto e porta aberta
 * para encher o banco.
 */
export const LIMITE_RESTRICOES = 20;
const LIMITE_TEXTO = 40;

export function normalizarRestricoes(entrada: readonly string[] | undefined | null): string[] {
  const vistas = new Set<string>();
  for (const bruta of entrada ?? []) {
    if (typeof bruta !== 'string') continue;
    const limpa = bruta
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, LIMITE_TEXTO);
    if (limpa) vistas.add(limpa);
    if (vistas.size >= LIMITE_RESTRICOES) break;
  }
  return [...vistas];
}
