import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { matricula, plano, academia, cobranca } from '../db/schema.js';
import { calcularRenovacao, type PeriodoRenovado } from '../dominio/renovacao.js';
import { statusDoAluno, diasParaVencer, type StatusAluno } from '../dominio/status.js';
import { hoje, diffDias, type DataISO } from '../dominio/datas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;

/** Um ano adiantado ja e muito; acima disso e quase sempre dedo errado. */
export const MAX_PERIODOS = 12;

export type ArgsPeriodo = {
  alunoId: number; planoId: number; dataPagamento: DataISO;
  /** quantos periodos do plano estao sendo pagos de uma vez (adiantamento) */
  periodos?: number;
  /** diária comprada para outro dia */
  dataInicioEscolhida?: DataISO | null;
  /** vencimento definido na mão pela recepção */
  dataFimManual?: DataISO | null;
};

/**
 * Com better-sqlite3 as consultas do Drizzle sao sincronas.
 * Usamos .get()/.all()/.run() em vez de await -- obrigatorio dentro de
 * db.transaction(): um await ali faria o commit acontecer antes das
 * escritas e a transacao viraria decorativa.
 */
export function criarServicoMatriculas(db: Db) {
  function matriculaAtualSync(alunoId: number, q: Db = db) {
    return q.select().from(matricula)
      .where(and(eq(matricula.alunoId, alunoId), eq(matricula.status, 'ativa')))
      .orderBy(desc(matricula.dataFim))
      .limit(1)
      .get() ?? null;
  }

  async function matriculaAtual(alunoId: number) {
    return matriculaAtualSync(alunoId);
  }

  /**
   * Quantos periodos cabem num pagamento so. Pagar 3 meses de uma vez da no
   * mesmo que registrar 3 pagamentos seguidos: a conta e a mesma, a ancora
   * tambem -- so poupa a recepcao de repetir a operacao.
   */
  function validarPeriodos(periodos: number | undefined, ehDiaria: boolean): number {
    const n = periodos ?? 1;
    if (!Number.isInteger(n) || n < 1 || n > MAX_PERIODOS) {
      throw new ErroNegocio(`Dá para adiantar de 1 a ${MAX_PERIODOS} períodos de uma vez.`);
    }
    if (n > 1 && ehDiaria) {
      throw new ErroNegocio('Diária não se adianta por período. Para vender mais dias, use um plano com a quantidade de dias que o aluno quer.');
    }
    return n;
  }

  /**
   * O calculo do periodo, sem gravar nada. A renovacao e a previa da tela
   * chamam isto -- e por isso que o que a recepcao LE antes de confirmar e
   * exatamente o que vai ser gravado depois.
   */
  function calcularPeriodo(args: ArgsPeriodo, q: Db = db): PeriodoRenovado & {
    planoNome: string; valorCentavos: number; periodos: number;
    dataFimAnterior: DataISO | null; diasAproveitados: number;
  } {
    const p = q.select().from(plano).where(eq(plano.id, args.planoId)).limit(1).get();
    if (!p) throw new ErroNaoEncontrado('Plano não encontrado');

    const periodos = validarPeriodos(args.periodos, p.duracaoDias != null);
    const anterior = matriculaAtualSync(args.alunoId, q);

    const periodo = calcularRenovacao({
      dataFimAnterior: anterior?.dataFim ?? null,
      diaAncoraAtual: anterior?.diaAncora ?? null,
      dataPagamento: args.dataPagamento,
      duracaoMeses: p.duracaoMeses * periodos,
      duracaoDias: p.duracaoDias,
      dataInicioEscolhida: args.dataInicioEscolhida ?? null,
      dataFimManual: args.dataFimManual ?? null,
    });

    // o que o aluno levou por ter pago antes de vencer; 0 quando pagou atrasado
    const diasAproveitados = anterior && args.dataPagamento <= anterior.dataFim
      ? Math.max(0, diffDias(args.dataPagamento, anterior.dataFim))
      : 0;

    return {
      ...periodo,
      planoNome: p.nome,
      valorCentavos: p.precoCentavos * periodos,
      periodos,
      dataFimAnterior: anterior?.dataFim ?? null,
      diasAproveitados,
    };
  }

  /**
   * O que a tela mostra antes de a recepcao confirmar: "vence 10/11, voce
   * aproveitou os 4 dias que faltavam". Nao grava nada.
   */
  function previa(args: ArgsPeriodo) {
    const r = calcularPeriodo(args);
    return {
      dataInicio: r.dataInicio, dataFim: r.dataFim, diaAncora: r.diaAncora,
      dataFimAnterior: r.dataFimAnterior, diasAproveitados: r.diasAproveitados,
      periodos: r.periodos, valorCentavos: r.valorCentavos, planoNome: r.planoNome,
    };
  }

  /**
   * Nucleo da renovacao, SEM abrir transacao: roda dentro da de quem chama.
   * Registrar pagamento usa isto para gravar pagamento + quitar cobranca +
   * renovar tudo numa transacao so (SQLite recusa BEGIN dentro de BEGIN).
   */
  function renovarEm(tx: Db, args: ArgsPeriodo & { observacao?: string }) {
    const periodo = calcularPeriodo(args, tx);
    const anterior = matriculaAtualSync(args.alunoId, tx);

    if (anterior) {
      tx.update(matricula).set({ status: 'encerrada' })
        .where(eq(matricula.id, anterior.id)).run();
      // a renovacao paga o periodo que a cobranca em aberto representava,
      // mesmo quando a recepcao registrou como pagamento avulso
      tx.update(cobranca).set({ status: 'paga' })
        .where(and(eq(cobranca.matriculaId, anterior.id), eq(cobranca.status, 'aberta'))).run();
    }

    return tx.insert(matricula).values({
      alunoId: args.alunoId,
      planoId: args.planoId,
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      diaAncora: periodo.diaAncora,
      valorCentavos: periodo.valorCentavos, // congela o preco vigente, vezes os periodos pagos
      status: 'ativa',
      observacao: args.observacao,
    }).returning().get();
  }

  /**
   * Encerrar a anterior e criar a nova acontecem numa transacao so.
   * Se a criacao falhar, a anterior continua ativa -- o aluno que acabou
   * de pagar nunca fica sem matricula.
   */
  async function renovar(args: ArgsPeriodo & { observacao?: string }) {
    return db.transaction((tx) => renovarEm(tx as unknown as Db, args));
  }

  async function statusDe(alunoId: number, hojeISO: DataISO = hoje()) {
    const atual = matriculaAtualSync(alunoId);
    const cfg = db.select().from(academia).limit(1).get();
    const diasAviso = cfg?.diasAvisoVencimento ?? 5;

    return {
      status: statusDoAluno(atual?.dataFim ?? null, hojeISO, diasAviso) as StatusAluno,
      diasParaVencer: diasParaVencer(atual?.dataFim ?? null, hojeISO),
      matricula: atual,
    };
  }

  return { matriculaAtual, matriculaAtualSync, renovar, renovarEm, previa, statusDe };
}

export type ServicoMatriculas = ReturnType<typeof criarServicoMatriculas>;
