import { eq, and, desc, lt, gte, like, sum, count } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { cobranca, pagamento, aluno, academia, plano, matricula } from '../db/schema.js';
import { montarBrCode } from '../dominio/pix.js';
import { hoje, diffDias, type DataISO } from '../dominio/datas.js';
import { criarServicoMatriculas } from './matriculas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;
type Forma = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'boleto';

export function criarServicoFinanceiro(db: Db) {
  const matriculas = criarServicoMatriculas(db);

  /**
   * Pagamento + quitacao da cobranca + renovacao: uma transacao so.
   * Se qualquer parte falhar, nada fica gravado pela metade.
   */
  function registrarPagamento(args: {
    alunoId: number; valorCentavos: number; forma: Forma;
    cobrancaId?: number; planoId?: number; dataPagamento?: DataISO;
    observacao?: string; usuarioId?: number;
    /** quantos periodos do plano o aluno esta adiantando num pagamento so */
    periodos?: number;
    /** diária marcada para outro dia */
    dataInicioEscolhida?: DataISO | null;
    /** vencimento escolhido na mão, em vez do calculado */
    dataFimManual?: DataISO | null;
  }) {
    if (!Number.isInteger(args.valorCentavos) || args.valorCentavos <= 0) {
      throw new ErroNegocio('Valor deve ser inteiro em centavos e maior que zero');
    }
    const dataPagamento = args.dataPagamento ?? hoje();

    return db.transaction((tx) => {
      const a = tx.select({ id: aluno.id }).from(aluno).where(eq(aluno.id, args.alunoId)).get();
      if (!a) throw new ErroNaoEncontrado('Aluno não encontrado');

      let planoId = args.planoId;

      if (args.cobrancaId) {
        const c = tx.select().from(cobranca).where(eq(cobranca.id, args.cobrancaId)).get();
        if (!c) throw new ErroNaoEncontrado('Cobrança não encontrada');
        if (c.alunoId !== args.alunoId) throw new ErroNegocio('Cobrança é de outro aluno');
        if (c.status !== 'aberta') throw new ErroNegocio('Cobrança já quitada ou cancelada');
        tx.update(cobranca).set({ status: 'paga' }).where(eq(cobranca.id, c.id)).run();
      }

      const pg = tx.insert(pagamento).values({
        alunoId: args.alunoId, cobrancaId: args.cobrancaId,
        valorCentavos: args.valorCentavos, forma: args.forma,
        dataPagamento, observacao: args.observacao,
        registradoPorUsuarioId: args.usuarioId,
      }).returning().get();

      const nova = planoId
        ? matriculas.renovarEm(tx as unknown as Db, {
            alunoId: args.alunoId, planoId, dataPagamento,
            periodos: args.periodos,
            dataInicioEscolhida: args.dataInicioEscolhida ?? null,
            dataFimManual: args.dataFimManual ?? null,
          })
        : null;

      return { pagamento: pg, matricula: nova };
    });
  }

  /**
   * A cobranca do proximo periodo nasce quando o plano entra na janela de aviso
   * (o mesmo prazo do "vencendo"), com o preco atual do plano. Roda antes de toda
   * leitura de cobrancas: e idempotente, a unicidade (matricula, competencia)
   * impede repeticao -- e cobranca paga ou cancelada nao volta.
   */
  function gerarCobrancasDevidas(hojeISO: DataISO = hoje()) {
    const diasAviso = db.select().from(academia).limit(1).get()?.diasAvisoVencimento ?? 5;
    const vigentes = db.select({
      matriculaId: matricula.id, alunoId: matricula.alunoId, dataFim: matricula.dataFim,
      preco: plano.precoCentavos, duracaoDias: plano.duracaoDias,
    }).from(matricula)
      .innerJoin(aluno, eq(aluno.id, matricula.alunoId))
      .innerJoin(plano, eq(plano.id, matricula.planoId))
      .where(and(eq(matricula.status, 'ativa'), eq(aluno.ativo, true))).all();
    for (const m of vigentes) {
      // diária não vira cobrança do mês seguinte: quem paga o dia não assinou nada
      if (m.duracaoDias != null) continue;
      if (diffDias(hojeISO, m.dataFim) > diasAviso) continue;
      db.insert(cobranca).values({
        matriculaId: m.matriculaId, alunoId: m.alunoId, competencia: m.dataFim.slice(0, 7),
        valorCentavos: m.preco, vencimento: m.dataFim,
      }).onConflictDoNothing().run();
    }
  }

  function cobrancasAbertas(hojeISO: DataISO = hoje()) {
    gerarCobrancasDevidas(hojeISO);
    return db.select({
      id: cobranca.id, alunoId: cobranca.alunoId, alunoNome: aluno.nome,
      competencia: cobranca.competencia, valorCentavos: cobranca.valorCentavos,
      vencimento: cobranca.vencimento, status: cobranca.status,
    }).from(cobranca)
      .innerJoin(aluno, eq(aluno.id, cobranca.alunoId))
      .where(eq(cobranca.status, 'aberta'))
      .orderBy(cobranca.vencimento).all();
  }

  function pagamentosRecentes(limite = 20) {
    return db.select({
      id: pagamento.id, alunoId: pagamento.alunoId, alunoNome: aluno.nome,
      valorCentavos: pagamento.valorCentavos, forma: pagamento.forma,
      dataPagamento: pagamento.dataPagamento, observacao: pagamento.observacao,
    }).from(pagamento)
      .innerJoin(aluno, eq(aluno.id, pagamento.alunoId))
      .orderBy(desc(pagamento.dataPagamento), desc(pagamento.id)).limit(limite).all();
  }

  function pagamentosDoAluno(alunoId: number) {
    return db.select().from(pagamento).where(eq(pagamento.alunoId, alunoId))
      .orderBy(desc(pagamento.dataPagamento)).all();
  }

  function brCode(valorCentavos: number, txid?: string) {
    const cfg = db.select().from(academia).limit(1).get();
    if (!cfg?.pixChave) throw new ErroNegocio('Chave Pix da academia não configurada. O dono cadastra em Configurações → Academia.');
    return montarBrCode({
      chave: cfg.pixChave,
      nomeRecebedor: cfg.pixNomeRecebedor ?? cfg.nome,
      cidade: cfg.pixCidade ?? 'BRASIL',
      valorCentavos, txid,
    });
  }

  function pixDaCobranca(cobrancaId: number) {
    const c = db.select().from(cobranca).where(eq(cobranca.id, cobrancaId)).get();
    if (!c) throw new ErroNaoEncontrado('Cobrança não encontrada');
    const payload = brCode(c.valorCentavos, `COB${c.id}`);
    db.update(cobranca).set({ pixPayload: payload, pixTxid: `COB${c.id}` })
      .where(eq(cobranca.id, c.id)).run();
    return { cobrancaId: c.id, valorCentavos: c.valorCentavos, payload };
  }

  /** Renovacao antecipada ou plano novo: ainda nao existe cobranca para amarrar o Pix. */
  function pixAvulso(valorCentavos: number) {
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) throw new ErroNegocio('Valor inválido');
    return { valorCentavos, payload: brCode(valorCentavos) };
  }

  /** mes 'YYYY-MM' */
  function receitaDoMes(mes: string): number {
    return Number(db.select({ t: sum(pagamento.valorCentavos) }).from(pagamento)
      .where(like(pagamento.dataPagamento, `${mes}-%`)).get()?.t ?? 0);
  }

  function recebidoEm(data: DataISO): number {
    return Number(db.select({ t: sum(pagamento.valorCentavos) }).from(pagamento)
      .where(eq(pagamento.dataPagamento, data)).get()?.t ?? 0);
  }

  /** Inadimplencia = cobrancas abertas com vencimento ja passado. */
  function inadimplencia(hojeISO: DataISO = hoje()): number {
    gerarCobrancasDevidas(hojeISO);
    return Number(db.select({ t: sum(cobranca.valorCentavos) }).from(cobranca)
      .where(and(eq(cobranca.status, 'aberta'), lt(cobranca.vencimento, hojeISO))).get()?.t ?? 0);
  }

  /** Matriculas vigentes por plano (ativa e ainda nao vencida). */
  function distribuicaoPorPlano(hojeISO: DataISO = hoje()) {
    const planos = db.select().from(plano).where(eq(plano.ativo, true)).orderBy(plano.ordem).all();
    return planos.map((p) => ({
      plano: p,
      quantidade: db.select({ n: count() }).from(matricula)
        .where(and(
          eq(matricula.planoId, p.id),
          eq(matricula.status, 'ativa'),
          gte(matricula.dataFim, hojeISO),
        )).get()?.n ?? 0,
    }));
  }

  return {
    registrarPagamento, cobrancasAbertas, pagamentosRecentes, pagamentosDoAluno,
    gerarCobrancasDevidas, pixDaCobranca, pixAvulso, receitaDoMes, recebidoEm, inadimplencia, distribuicaoPorPlano,
  };
}
