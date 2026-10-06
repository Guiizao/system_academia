/** Converte reais (float vindo de formulário) para centavos inteiros. */
export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais)) throw new Error('Valor inválido');
  // toFixed antes do round evita 89.9 * 100 === 8989.999999999999
  return Math.round(Number((reais * 100).toFixed(4)));
}

export function centavosParaReais(centavos: number): number {
  garantirInteiro(centavos);
  return centavos / 100;
}

export function formatarBRL(centavos: number): string {
  garantirInteiro(centavos);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(centavos / 100).replace(/\u00A0/g, ' ');
}

function garantirInteiro(centavos: number): void {
  if (!Number.isInteger(centavos)) {
    throw new Error(`Centavos deve ser inteiro, recebido: ${centavos}`);
  }
}
