import { diffDias, type DataISO } from './datas.js';

export type StatusAluno = 'ativo' | 'vencendo' | 'vencido' | 'inativo';

/**
 * Status e SEMPRE derivado -- nunca armazenado.
 * Uma implementacao so, consumida por telas, relatorios, job e bots.
 */
export function statusDoAluno(
  dataFim: DataISO | null,
  hojeISO: DataISO,
  diasAviso: number,
): StatusAluno {
  if (!dataFim) return 'inativo';
  const dias = diffDias(hojeISO, dataFim);
  if (dias < 0) return 'vencido';
  if (dias <= diasAviso) return 'vencendo';
  return 'ativo';
}

export function diasParaVencer(dataFim: DataISO | null, hojeISO: DataISO): number | null {
  return dataFim ? diffDias(hojeISO, dataFim) : null;
}
