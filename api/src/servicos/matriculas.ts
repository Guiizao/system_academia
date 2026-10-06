import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { matricula, plano, academia, cobranca } from '../db/schema.js';
import { calcularRenovacao } from '../dominio/renovacao.js';
import { statusDoAluno, diasParaVencer, type StatusAluno } from '../dominio/status.js';
import { hoje, type DataISO } from '../dominio/datas.js';

type Db = BetterSQLite3Database<any>;

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
   * Nucleo da renovacao, SEM abrir transacao: roda dentro da de quem chama.
   * Registrar pagamento usa isto para gravar pagamento + quitar cobranca +
   * renovar tudo numa transacao so (SQLite recusa BEGIN dentro de BEGIN).
   */
  function renovarEm(tx: Db, args: {
    alunoId: number; planoId: number; dataPagamento: DataISO; observacao?: string;
    /** diária comprada para outro dia */
    dataInicioEscolhida?: DataISO | null;
    /** vencimento definido na mão pela recepção */
    dataFimManual?: DataISO | null;
  }) {
    const p = tx.select().from(plano).where(eq(plano.id, args.planoId)).limit(1).get();
    if (!p) throw new Error('Plano não encontrado');

    const anterior = matriculaAtualSync(args.alunoId, tx);

    const periodo = calcularRenovacao({
      dataFimAnterior: anterior?.dataFim ?? null,
      diaAncoraAtual: anterior?.diaAncora ?? null,
      dataPagamento: args.dataPagamento,
      duracaoMeses: p.duracaoMeses,
      duracaoDias: p.duracaoDias,
      dataInicioEscolhida: args.dataInicioEscolhida ?? null,
      dataFimManual: args.dataFimManual ?? null,
    });

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
      planoId: p.id,
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      diaAncora: periodo.diaAncora,
      valorCentavos: p.precoCentavos, // congela o preco vigente
      status: 'ativa',
      observacao: args.observacao,
    }).returning().get();
  }

  /**
   * Encerrar a anterior e criar a nova acontecem numa transacao so.
   * Se a criacao falhar, a anterior continua ativa -- o aluno que acabou
   * de pagar nunca fica sem matricula.
   */
  async function renovar(args: {
    alunoId: number; planoId: number; dataPagamento: DataISO; observacao?: string;
    dataInicioEscolhida?: DataISO | null; dataFimManual?: DataISO | null;
  }) {
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

  return { matriculaAtual, matriculaAtualSync, renovar, renovarEm, statusDe };
}

export type ServicoMatriculas = ReturnType<typeof criarServicoMatriculas>;
