import { sql, type SQLWrapper } from 'drizzle-orm';

export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function contemBusca(campo: SQLWrapper, texto: string) {
  return sql`instr(normalizar_busca(${campo}), ${normalizarBusca(texto)}) > 0`;
}
