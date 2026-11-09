import type { DataISO, StatusAluno } from '../tipos';
import { diffDias, formatarData, somarMes } from './index';

/* ─── linha do tempo dos meses pagos (pedido do João, 19/10) ─────────
   Cada mês é uma caixinha; o verde preenche exatamente os dias cobertos
   pelas matrículas, então "vence dia 5" aparece como uma sobra no mês
   seguinte, em vez de o mês inteiro parecer pago. */

export type Periodo = { dataInicio: DataISO; dataFim: DataISO };
/** pedaço do mês, de 0 (dia 1) a 1 (fim do mês) */
export type Faixa = { de: number; ate: number; tipo: 'pago' | 'vencido' };
export type MesDaLinha = {
  mes: string; rotulo: string;
  /** só no primeiro mês e em janeiro, para não repetir o ano em todos */
  ano: string | null;
  faixas: Faixa[];
  /** onde fica hoje dentro do mês, ou null em outro mês */
  hoje: number | null;
  /** o mês como a recepção fala: pago, vencido (devendo) ou null */
  estado: 'pago' | 'vencido' | null;
};

export const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MAX_MESES = 12;

const maior = (a: string, b: string) => (a > b ? a : b);
const menor = (a: string, b: string) => (a < b ? a : b);
const somarDia = (d: DataISO) => {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia + 1)).toISOString().slice(0, 10);
};

/**
 * "Outubro pago" na fala do balcão: quem começou dia 20/10 pagou outubro, mesmo
 * com a maior parte dos dias caindo em novembro. Vale o dia em que o período
 * começou, repetido a cada mês; o vencimento já é o começo do próximo.
 */
function mesCoberto(mes: string, p: Periodo): boolean {
  const [a, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const dia = `${mes}-${String(Math.min(Number(p.dataInicio.slice(8)), ultimoDia)).padStart(2, '0')}`;
  return dia === p.dataInicio || (dia > p.dataInicio && dia < p.dataFim);
}

/**
 * Os meses a desenhar: até 3 para trás (contexto), o de hoje e o que já
 * está pago para a frente; no máximo 12. O dia do vencimento ainda vale
 * (o status só vira vencido no dia seguinte), então o período vai até o fim
 * de dataFim: é isso que faz a diária de um dia aparecer.
 */
export function mesesPagos(periodos: Periodo[], hojeISO: DataISO, status: StatusAluno): MesDaLinha[] {
  if (!periodos.length) return [];
  const mesHoje = hojeISO.slice(0, 7);
  const primeiro = periodos.reduce((m, p) => menor(m, p.dataInicio), periodos[0].dataInicio).slice(0, 7);
  const ultimoFim = periodos.reduce((m, p) => maior(m, p.dataFim), periodos[0].dataFim);

  const fim = menor(maior(somarMes(mesHoje, 1), ultimoFim.slice(0, 7)), somarMes(mesHoje, MAX_MESES - 1));
  // menor(primeiro, mesHoje): diária marcada para daqui a meses ainda mostra o mês de hoje
  const inicio = maior(maior(menor(primeiro, mesHoje), menor(somarMes(mesHoje, -3), somarMes(ultimoFim.slice(0, 7), -2))),
    somarMes(fim, -(MAX_MESES - 1)));

  // só quem está vencido deve: o inativo saiu, então o vazio dele não é dívida
  const intervalos = periodos.map((p) => ({ de: p.dataInicio, ate: somarDia(p.dataFim), tipo: 'pago' as const }));
  const devendo = status === 'vencido' && ultimoFim < hojeISO
    ? [{ de: somarDia(ultimoFim), ate: somarDia(hojeISO), tipo: 'vencido' as const }] : [];

  const meses: MesDaLinha[] = [];
  for (let mes = inicio; mes <= fim; mes = somarMes(mes, 1)) {
    const dia1 = `${mes}-01`;
    const proximo = `${somarMes(mes, 1)}-01`;
    const dias = diffDias(dia1, proximo);
    const faixas: Faixa[] = [];
    for (const i of [...intervalos, ...devendo]) {
      const de = maior(i.de, dia1);
      const ate = menor(i.ate, proximo);
      if (ate > de) faixas.push({ de: diffDias(dia1, de) / dias, ate: diffDias(dia1, ate) / dias, tipo: i.tipo });
    }
    faixas.sort((a, b) => a.de - b.de);
    // pedaços do mesmo tipo que se encostam viram um só: sem emenda no desenho
    const juntas = faixas.reduce<Faixa[]>((acc, f) => {
      const ult = acc[acc.length - 1];
      if (ult && ult.tipo === f.tipo && f.de <= ult.ate) ult.ate = Math.max(ult.ate, f.ate);
      else acc.push({ ...f });
      return acc;
    }, []);
    const [a, m] = mes.split('-');
    meses.push({
      mes, rotulo: NOME_MES[Number(m) - 1].slice(0, 3),
      ano: mes === inicio || m === '01' ? a : null,
      faixas: juntas,
      hoje: mes === mesHoje ? (Number(hojeISO.slice(8)) - 0.5) / dias : null,
      estado: periodos.some((p) => mesCoberto(mes, p)) ? 'pago'
        : status === 'vencido' && mes >= ultimoFim.slice(0, 7) && mes <= mesHoje ? 'vencido' : null,
    });
  }
  return meses;
}

/**
 * O trecho pago sem buraco que termina no último vencimento: é o que o leitor
 * de tela fala ("pago de 05/10 a 05/02"), em vez de arredondar para meses.
 */
export function trechoPago(periodos: Periodo[]): { de: DataISO; ate: DataISO } | null {
  if (!periodos.length) return null;
  const ord = [...periodos].sort((a, b) => (a.dataFim < b.dataFim ? -1 : a.dataFim > b.dataFim ? 1 : 0));
  let { dataInicio: de } = ord[ord.length - 1];
  const ate = ord[ord.length - 1].dataFim;
  for (let i = ord.length - 2; i >= 0; i--) {
    if (somarDia(ord[i].dataFim) < de) break; // buraco: o que vem antes é de outra vez
    if (ord[i].dataInicio < de) de = ord[i].dataInicio;
  }
  return { de, ate };
}

export function resumoPagos(periodos: Periodo[], hojeISO: DataISO): string {
  const fim = periodos.reduce((m, p) => maior(m, p.dataFim), '');
  return `${fim >= hojeISO ? 'Pago até' : 'Venceu em'} ${formatarData(fim)}`;
}
