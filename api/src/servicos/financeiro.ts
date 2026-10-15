import { eq, and, desc, lt, gte, notExists, like, sum, count, sql, getTableColumns, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { cobranca, pagamento, aluno, academia, plano, matricula } from '../db/schema.js';
import { contemBusca } from '../db/busca.js';
import { montarBrCode } from '../dominio/pix.js';
import { hoje, diffDias, adicionarMeses, type DataISO } from '../dominio/datas.js';
import { criarServicoMatriculas } from './matriculas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;
type Forma = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'boleto';
export type PagamentoDetalhe = typeof pagamento.$inferSelect & {
  alunoNome: string; planoId: number | null; planoNome: string | null; alteraVencimento: boolean;
};

export function criarServicoFinanceiro(db: Db) {
  const matriculas = criarServicoMatriculas(db);

  // A mesma associação serve à leitura, à exclusão e à edição, inclusive no legado.
  const matriculaAtualDoPagamento = sql<number | null>`(select atual.id from matricula atual
    where atual.aluno_id = ${pagamento.alunoId} and atual.status = 'ativa'
    order by atual.data_fim desc limit 1)`;
  const matriculaDoPagamento = sql<number | null>`coalesce(${pagamento.matriculaId},
    (select candidata.id from matricula candidata
      where candidata.aluno_id = ${pagamento.alunoId}
        and candidata.criado_em >= ${pagamento.criadoEm}
        and candidata.criado_em <= strftime('%Y-%m-%dT%H:%M:%fZ', ${pagamento.criadoEm}, '+60 seconds')
        and not exists (select 1 from pagamento vinculado where vinculado.matricula_id = candidata.id)
      order by (candidata.id = (select atual.id from matricula atual
        where atual.aluno_id = candidata.aluno_id and atual.status = 'ativa'
        order by atual.data_fim desc limit 1)) desc, candidata.id desc limit 1))`;

  function pagamentosDetalhados(condicao?: SQL, limite = -1, q: Db = db): PagamentoDetalhe[] {
    return q.select({
      ...getTableColumns(pagamento), alunoNome: aluno.nome,
      matriculaId: matricula.id, planoId: plano.id, planoNome: plano.nome,
      alteraVencimento: sql<boolean>`coalesce(${matricula.id} = ${matriculaAtualDoPagamento}
        and (${pagamento.matriculaId} is not null or not exists
          (select 1 from pagamento posterior where posterior.aluno_id = ${pagamento.alunoId}
            and posterior.id > ${pagamento.id})), 0)`.mapWith(Boolean),
    }).from(pagamento)
      .innerJoin(aluno, eq(aluno.id, pagamento.alunoId))
      .leftJoin(matricula, eq(matricula.id, matriculaDoPagamento))
      .leftJoin(plano, eq(plano.id, matricula.planoId))
      .where(condicao).orderBy(desc(pagamento.dataPagamento), desc(pagamento.id)).limit(limite).all();
  }

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

      let pg = tx.insert(pagamento).values({
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

      if (nova) pg = tx.update(pagamento).set({ matriculaId: nova.id })
        .where(eq(pagamento.id, pg.id)).returning().get()!;

      return { pagamento: pg, matricula: nova };
    });
  }

  function excluirPagamento(pagamentoId: number) {
    return db.transaction((tx) => excluirPagamentoEm(tx as unknown as Db, pagamentoId));
  }

  function excluirPagamentoEm(tx: Db, pagamentoId: number) {
    const registro = pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0];
    if (!registro) throw new ErroNaoEncontrado('Pagamento não encontrado');
    const atual = matriculas.matriculaAtualSync(registro.alunoId, tx);
    const matriculaId = registro.matriculaId;
    const recusarAnterior = () => { throw new ErroNegocio('Exclua primeiro o pagamento mais recente deste aluno.'); };

    if (matriculaId != null && !registro.alteraVencimento) recusarAnterior();
    tx.delete(pagamento).where(eq(pagamento.id, registro.id)).run();
    const semPagamento = notExists(tx.select({ id: pagamento.id }).from(pagamento)
      .where(eq(pagamento.cobrancaId, cobranca.id)));

    if (registro.cobrancaId != null) tx.update(cobranca).set({ status: 'aberta' })
      .where(and(eq(cobranca.id, registro.cobrancaId), semPagamento)).run();

    let dataFimNova = atual?.dataFim ?? null;
    if (matriculaId != null) {
      // Cobranças automáticas do período desfeito também deixam de existir.
      const comPagamento = tx.select({ id: pagamento.id }).from(pagamento)
        .innerJoin(cobranca, eq(cobranca.id, pagamento.cobrancaId))
        .where(eq(cobranca.matriculaId, matriculaId)).get();
      if (comPagamento) recusarAnterior();
      tx.delete(cobranca).where(eq(cobranca.matriculaId, matriculaId)).run();
      tx.delete(matricula).where(eq(matricula.id, matriculaId)).run();
      const anterior = tx.select().from(matricula).where(and(
        eq(matricula.alunoId, registro.alunoId), eq(matricula.status, 'encerrada'),
        lt(matricula.id, matriculaId),
      )).orderBy(desc(matricula.id)).get();
      if (anterior) {
        tx.update(matricula).set({ status: 'ativa' }).where(eq(matricula.id, anterior.id)).run();
        tx.update(cobranca).set({ status: 'aberta' }).where(and(
          eq(cobranca.matriculaId, anterior.id), eq(cobranca.status, 'paga'), semPagamento,
        )).run();
      }
      dataFimNova = anterior?.dataFim ?? null;
    }
    return { ok: true, alunoId: registro.alunoId, dataFimNova };
  }

  function editarPagamento(pagamentoId: number, dados: {
    dataPagamento?: DataISO; valorCentavos?: number; forma?: Forma;
    planoId?: number; periodos?: number; observacao?: string;
  }) {
    if (dados.valorCentavos !== undefined && (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0)) {
      throw new ErroNegocio('Valor deve ser inteiro em centavos e maior que zero');
    }
    return db.transaction((transacao) => {
      const tx = transacao as unknown as Db;
      const registro = tx.select().from(pagamento).where(eq(pagamento.id, pagamentoId)).get();
      if (!registro) throw new ErroNaoEncontrado('Pagamento não encontrado');
      const detalhe = pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0];
      const mudouPeriodo = (dados.dataPagamento !== undefined && dados.dataPagamento !== registro.dataPagamento)
        || (dados.planoId !== undefined && dados.planoId !== detalhe.planoId) || dados.periodos !== undefined;
      if (detalhe.matriculaId != null && !detalhe.alteraVencimento && mudouPeriodo) {
        throw new ErroNegocio('Esse pagamento tem renovação depois dele: só dá para mudar valor, forma e observação.');
      }
      const { planoId, periodos, ...campos } = dados;
      const atualizado = { ...registro, ...campos, atualizadoEm: new Date().toISOString() };
      let dataFimNova = matriculas.matriculaAtualSync(registro.alunoId, tx)?.dataFim ?? null;
      // Só data, plano ou períodos refazem a renovação. Corrigir valor, forma ou
      // observação não toca na matrícula: refazê-la apagaria as cobranças do período.
      if (mudouPeriodo && (detalhe.alteraVencimento || (detalhe.matriculaId == null && planoId !== undefined))) {
        const anterior = detalhe.matriculaId == null ? null
          : tx.select().from(matricula).where(eq(matricula.id, detalhe.matriculaId)).get()!;
        if (detalhe.alteraVencimento) excluirPagamentoEm(tx, pagamentoId);
        const nova = matriculas.renovarEm(tx, {
          alunoId: registro.alunoId, planoId: planoId ?? detalhe.planoId!,
          dataPagamento: atualizado.dataPagamento, periodos,
          observacao: anterior?.observacao ?? undefined,
        });
        atualizado.matriculaId = nova.id;
        if (detalhe.alteraVencimento) tx.insert(pagamento).values(atualizado).run();
        else tx.update(pagamento).set(atualizado).where(eq(pagamento.id, pagamentoId)).run();
        if (registro.cobrancaId != null) tx.update(cobranca).set({ status: 'paga' })
          .where(eq(cobranca.id, registro.cobrancaId)).run();
        dataFimNova = nova.dataFim;
      } else {
        tx.update(pagamento).set(atualizado).where(eq(pagamento.id, pagamentoId)).run();
      }
      return { ok: true, pagamento: pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0], dataFimNova };
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
    return pagamentosDetalhados(eq(pagamento.alunoId, alunoId));
  }

  function historico(filtro: { mes?: string; busca?: string } = {}) {
    const busca = filtro.busca?.trim();
    const mes = filtro.mes ?? (busca ? undefined : hoje().slice(0, 7));
    const itens = pagamentosDetalhados(and(
      mes ? and(gte(pagamento.dataPagamento, `${mes}-01`),
        lt(pagamento.dataPagamento, adicionarMeses(`${mes}-01`, 1, 1))) : undefined,
      busca ? contemBusca(aluno.nome, busca) : undefined,
    ), mes ? -1 : 500);
    const formas = new Map<Forma, { forma: Forma; totalCentavos: number; quantidade: number }>();
    const dias = new Map<string, number>();
    let totalCentavos = 0;
    for (const item of itens) {
      totalCentavos += item.valorCentavos;
      const resumo = formas.get(item.forma) ?? { forma: item.forma, totalCentavos: 0, quantidade: 0 };
      resumo.totalCentavos += item.valorCentavos;
      resumo.quantidade++;
      formas.set(item.forma, resumo);
      if (mes) dias.set(item.dataPagamento, (dias.get(item.dataPagamento) ?? 0) + item.valorCentavos);
    }
    const inicioAtual = `${hoje().slice(0, 7)}-01`;
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: adicionarMeses(inicioAtual, i - 11, 1).slice(0, 7), totalCentavos: 0, quantidade: 0,
    }));
    const mesPagamento = sql<string>`substr(${pagamento.dataPagamento}, 1, 7)`;
    const totais = db.select({ mes: mesPagamento, totalCentavos: sum(pagamento.valorCentavos), quantidade: count() })
      .from(pagamento).where(and(gte(pagamento.dataPagamento, `${meses[0].mes}-01`),
        lt(pagamento.dataPagamento, adicionarMeses(inicioAtual, 1, 1))))
      .groupBy(mesPagamento).all();
    for (const resumo of meses) {
      const total = totais.find((t) => t.mes === resumo.mes);
      resumo.totalCentavos = Number(total?.totalCentavos ?? 0);
      resumo.quantidade = total?.quantidade ?? 0;
    }
    return {
      itens, totalCentavos, quantidade: itens.length,
      porForma: [...formas.values()].sort((a, b) => b.totalCentavos - a.totalCentavos),
      porDia: [...dias.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([data, totalCentavos]) => ({ data, totalCentavos })),
      meses,
    };
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
    registrarPagamento, excluirPagamento, editarPagamento, historico, cobrancasAbertas, pagamentosRecentes, pagamentosDoAluno,
    gerarCobrancasDevidas, pixDaCobranca, pixAvulso, receitaDoMes, recebidoEm, inadimplencia, distribuicaoPorPlano,
  };
}
