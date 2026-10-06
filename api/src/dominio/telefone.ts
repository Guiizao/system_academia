const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19, 21,22,24, 27,28,
  31,32,33,34,35,37,38, 41,42,43,44,45,46, 47,48,49,
  51,53,54,55, 61, 62,64, 63, 65,66, 67, 68, 69,
  71,73,74,75,77, 79, 81,87, 82, 83, 84, 85,88, 86,89,
  91,93,94, 92,97, 95, 96, 98,99,
]);

/** Normaliza telefone brasileiro para E.164. Lança se inválido. */
export function normalizarTelefone(entrada: string): string {
  let d = (entrada ?? '').replace(/\D/g, '');

  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);

  if (d.length !== 10 && d.length !== 11) {
    throw new Error('Telefone inválido');
  }
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) {
    throw new Error('Telefone inválido');
  }
  if (d.length === 11 && d[2] !== '9') {
    throw new Error('Telefone inválido');
  }

  return `+55${d}`;
}

export function telefoneValido(entrada: string): boolean {
  try { normalizarTelefone(entrada); return true; } catch { return false; }
}
