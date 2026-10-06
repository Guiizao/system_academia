/**
 * Mover um item de lugar na lista.
 *
 * As setas da tela de planos usam isto: a tela troca a posicao na hora (sem
 * esperar a rede) e manda a sequencia nova para o servidor gravar.
 */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) {
    return [...lista];
  }
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** Primeiro e ultimo nao tem para onde ir: a seta fica desligada. */
export function podeMover(indice: number, total: number, direcao: -1 | 1): boolean {
  const destino = indice + direcao;
  return destino >= 0 && destino < total;
}
