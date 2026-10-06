export type DataISO = string; // 'YYYY-MM-DD'

const RE = /^\d{4}-\d{2}-\d{2}$/;

function partes(d: DataISO): [number, number, number] {
  if (!RE.test(d)) throw new Error(`Data inválida: ${d}`);
  const [a, m, dia] = d.split('-').map(Number);
  return [a, m, dia];
}

function montar(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function hoje(): DataISO {
  // Data de calendário no fuso da academia, não UTC.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function ultimoDiaDoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

/**
 * Soma meses preservando o dia âncora original da matrícula.
 * Sem a âncora o vencimento escorrega de vez ao passar por mês curto:
 * 31/01 -> 28/02 -> 28/03. Com ela: 31/01 -> 28/02 -> 31/03.
 */
export function adicionarMeses(inicio: DataISO, meses: number, diaAncora: number): DataISO {
  const [ano, mes] = partes(inicio);
  if (!Number.isInteger(diaAncora) || diaAncora < 1 || diaAncora > 31) {
    throw new Error(`Dia âncora inválido: ${diaAncora}`);
  }

  const totalMeses = (ano * 12 + (mes - 1)) + meses;
  const novoAno = Math.floor(totalMeses / 12);
  const novoMes = (totalMeses % 12) + 1;

  const dia = Math.min(diaAncora, ultimoDiaDoMes(novoAno, novoMes));
  return montar(novoAno, novoMes, dia);
}

/**
 * Soma dias corridos. Em UTC: somar hora local atravessaria o horario de verao
 * e devolveria o dia anterior em algumas datas.
 */
export function adicionarDias(inicio: DataISO, dias: number): DataISO {
  const [ano, mes, dia] = partes(inicio);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return montar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function diffDias(de: DataISO, ate: DataISO): number {
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

export function maiorData(a: DataISO, b: DataISO): DataISO {
  partes(a); partes(b);
  return a >= b ? a : b; // ISO ordena lexicograficamente
}

/**
 * Dia de calendario de um instante NO FUSO DA ACADEMIA.
 * 21:30 em Sao Paulo e 00:30 UTC do dia seguinte -- este e o dia certo.
 */
export function dataLocalDe(instante: Date): DataISO {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instante);
}
