import { adicionarMeses, adicionarDias, type DataISO } from './datas.js';

export type PeriodoRenovado = {
  dataInicio: DataISO;
  dataFim: DataISO;
  diaAncora: number;
};

export interface ArgsRenovacao {
  dataFimAnterior: DataISO | null;
  diaAncoraAtual: number | null;
  dataPagamento: DataISO;
  duracaoMeses: number;
  /** Diária: vale N dias corridos, sem mês e sem âncora. */
  duracaoDias?: number | null;
  /** O aluno marcou o dia em que vem (diária comprada antes). */
  dataInicioEscolhida?: DataISO | null;
  /** Vencimento definido na mão pela recepção; manda em cima da conta. */
  dataFimManual?: DataISO | null;
}

/**
 * Regra da secao 5.2 da spec (mensalidade):
 *   - pagamento adiantado ou em dia -> conta do vencimento antigo, ancora preservada
 *   - pagamento atrasado            -> conta da data do pagamento, ancora RESETADA
 *
 * O reset da ancora no atraso e essencial: manter a ancora antiga entregaria
 * periodo mutilado (pagou 10/03 com ancora 31 -> venceria 31/03, 21 dias).
 *
 * Diaria e outra coisa: nao renova nada, nao emenda no plano anterior e acaba
 * no proprio dia (ou no N-esimo). Quem paga diaria nao espera cobranca no mes
 * seguinte.
 */
export function calcularRenovacao(args: ArgsRenovacao): PeriodoRenovado {
  const {
    dataFimAnterior, diaAncoraAtual, dataPagamento, duracaoMeses,
    duracaoDias, dataInicioEscolhida, dataFimManual,
  } = args;

  const ehDiaria = duracaoDias != null;
  if (ehDiaria) {
    if (!Number.isInteger(duracaoDias) || (duracaoDias as number) < 1) {
      throw new Error(`Duração inválida: ${duracaoDias} dia(s)`);
    }
  } else if (duracaoMeses < 1 || !Number.isInteger(duracaoMeses)) {
    throw new Error(`Duração inválida: ${duracaoMeses}`);
  }

  const periodo = ehDiaria
    ? diaria(dataPagamento, duracaoDias as number, dataInicioEscolhida ?? null)
    : mensalidade(dataFimAnterior, diaAncoraAtual, dataPagamento, duracaoMeses);

  if (!dataFimManual) return periodo;
  if (dataFimManual < periodo.dataInicio) {
    throw new Error(`O vencimento (${dataFimManual}) não pode ser antes do início (${periodo.dataInicio})`);
  }
  return { ...periodo, dataFim: dataFimManual, diaAncora: Number(dataFimManual.slice(8, 10)) };
}

function diaria(dataPagamento: DataISO, dias: number, escolhida: DataISO | null): PeriodoRenovado {
  const dataInicio = escolhida ?? dataPagamento;
  return {
    dataInicio,
    // 1 diária acaba no próprio dia, 3 diárias no terceiro
    dataFim: adicionarDias(dataInicio, dias - 1),
    diaAncora: Number(dataInicio.slice(8, 10)),
  };
}

function mensalidade(
  dataFimAnterior: DataISO | null, diaAncoraAtual: number | null,
  dataPagamento: DataISO, duracaoMeses: number,
): PeriodoRenovado {
  const atrasadoOuNovo = !dataFimAnterior || dataPagamento > dataFimAnterior;
  const dataInicio = atrasadoOuNovo ? dataPagamento : dataFimAnterior;
  const diaAncora = atrasadoOuNovo
    ? Number(dataPagamento.slice(8, 10))
    : (diaAncoraAtual ?? Number(dataInicio.slice(8, 10)));

  return { dataInicio, dataFim: adicionarMeses(dataInicio, duracaoMeses, diaAncora), diaAncora };
}
