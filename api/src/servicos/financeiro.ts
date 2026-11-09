import { eq, and, inArray, desc, lt, lte, gt, gte, notExists, like, sum, count, sql, getTableColumns, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { cobranca, pagamento, venda, pagamentoAlteracao, aluno, academia, plano, matricula, usuario, type PagamentoEstado } from '../db/schema.js';
import { contemBusca } from '../db/busca.js';
import { montarBrCode } from '../dominio/pix.js';
import { hoje, diffDias, adicionarMeses, type DataISO } from '../dominio/datas.js';
import { calcularRenovacao } from '../dominio/renovacao.js';
import { criarServicoMatriculas } from './matriculas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;
type Forma = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'boleto';
export type PagamentoDetalhe = typeof pagamento.$inferSelect & {
  alunoNome: string; planoId: number | null; planoNome: string | null; alteraVencimento: boolean;
  registradoPorNome: string | null; editado: boolean;
};

function estadoPagamento({ dataPagamento, valorCentavos, forma, planoNome, periodos, observacao }: PagamentoDetalhe): PagamentoEstado {
  return { dataPagamento, valorCentavos, forma, planoNome, periodos, observacao };
}

function validarDataPagamento(data: DataISO) {
  if (data > hoje()) throw new ErroNegocio('A data do pagamento não pode ser depois de hoje.');
}

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

  function pagamentosDetalhados(condicao?: SQL, limite = -1, q: Db = db, deslocamento = 0): PagamentoDetalhe[] {
    return q.select({
      ...getTableColumns(pagamento), alunoNome: aluno.nome,
      matriculaId: matricula.id, planoId: plano.id, planoNome: plano.nome,
      registradoPorNome: usuario.nome,
      editado: sql<boolean>`exists(select 1 from ${pagamentoAlteracao}
        where ${pagamentoAlteracao.pagamentoId} = ${pagamento.id}
          and ${pagamentoAlteracao.acao} = 'editou')`.mapWith(Boolean),
      alteraVencimento: sql<boolean>`coalesce(${matricula.id} = ${matriculaAtualDoPagamento}
        and (${pagamento.matriculaId} is not null or not exists
          (select 1 from pagamento posterior where posterior.aluno_id = ${pagamento.alunoId}
            and posterior.id > ${pagamento.id})), 0)`.mapWith(Boolean),
    }).from(pagamento)
      .innerJoin(aluno, eq(aluno.id, pagamento.alunoId))
      .leftJoin(matricula, eq(matricula.id, matriculaDoPagamento))
      .leftJoin(plano, eq(plano.id, matricula.planoId))
      .leftJoin(usuario, eq(usuario.id, pagamento.registradoPorUsuarioId))
      .where(condicao).orderBy(desc(pagamento.dataPagamento), desc(pagamento.id)).limit(limite).offset(deslocamento).all();
  }

  /**
   * Pagamento + quitacao da cobranca + renovacao: uma transacao so.
   * Se qualquer parte falhar, nada fica gravado pela metade.
   */
  function registrarPagamento(args: {
    alunoId: number; valorCentavos: number; forma: Forma;
    cobrancaId?: number; planoId?: number; dataPagamento?: DataISO;
    observacao?: string; usuarioId?: number; vendasIds?: number[];
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
    validarDataPagamento(dataPagamento);

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
        periodos: planoId ? (args.periodos ?? 1) : null,
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

      if (args.vendasIds?.length) {
        if (args.forma === 'boleto') throw new ErroNegocio('Boleto não recebe produto junto.');
        const ids = [...new Set(args.vendasIds)];
        const vendas = tx.select().from(venda).where(inArray(venda.id, ids)).all();
        if (vendas.length !== ids.length || vendas.some((v) => v.alunoId !== args.alunoId || v.situacao !== 'fiado')) {
          throw new ErroNegocio('Venda inexistente, de outro aluno ou já paga.');
        }
        tx.update(venda).set({ situacao: 'paga', forma: args.forma, pagaEm: dataPagamento,
          pagamentoId: pg.id, atualizadoEm: new Date().toISOString(),
        }).where(inArray(venda.id, ids)).run();
      }
      return { pagamento: pg, matricula: nova };
    });
  }

  function excluirPagamento(pagamentoId: number, usuarioId?: number) {
    return db.transaction((transacao) => {
      const tx = transacao as unknown as Db;
      const antes = pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0];
      const resultado = excluirPagamentoEm(tx, pagamentoId);
      tx.insert(pagamentoAlteracao).values({
        pagamentoId, alunoId: antes.alunoId, acao: 'excluiu', usuarioId,
        antes: estadoPagamento(antes), depois: null,
      }).run();
      return resultado;
    });
  }

  function excluirPagamentoEm(tx: Db, pagamentoId: number) {
    const registro = pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0];
    if (!registro) throw new ErroNaoEncontrado('Pagamento não encontrado');
    const atual = matriculas.matriculaAtualSync(registro.alunoId, tx);
    const matriculaId = registro.matriculaId;
    const recusarAnterior = () => { throw new ErroNegocio('Exclua primeiro o pagamento mais recente deste aluno.'); };

    if (matriculaId != null && !registro.alteraVencimento) recusarAnterior();
    tx.update(venda).set({ situacao: 'fiado', forma: null, pagaEm: null, pagamentoId: null,
      atualizadoEm: new Date().toISOString(),
    }).where(eq(venda.pagamentoId, registro.id)).run();
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
  }, usuarioId?: number) {
    if (dados.valorCentavos !== undefined && (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0)) {
      throw new ErroNegocio('Valor deve ser inteiro em centavos e maior que zero');
    }
    if (dados.dataPagamento !== undefined) validarDataPagamento(dados.dataPagamento);
    return db.transaction((transacao) => {
      const tx = transacao as unknown as Db;
      const registro = tx.select().from(pagamento).where(eq(pagamento.id, pagamentoId)).get();
      if (!registro) throw new ErroNaoEncontrado('Pagamento não encontrado');
      const vendasLigadas = tx.select({ id: venda.id }).from(venda).where(eq(venda.pagamentoId, pagamentoId)).all();
      const formaVenda = dados.forma ?? registro.forma;
      if (vendasLigadas.length && formaVenda === 'boleto') throw new ErroNegocio('Boleto não recebe produto junto.');
      const detalhe = pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0];
      const mudouPeriodo = (dados.dataPagamento !== undefined && dados.dataPagamento !== registro.dataPagamento)
        || (dados.planoId !== undefined && dados.planoId !== detalhe.planoId)
        || (dados.periodos !== undefined && dados.periodos !== registro.periodos);
      if (detalhe.matriculaId != null && !detalhe.alteraVencimento && mudouPeriodo) {
        throw new ErroNegocio('Esse pagamento tem renovação depois dele: só dá para mudar valor, forma e observação.');
      }
      const { planoId, periodos, ...campos } = dados;
      const atualizado = { ...registro, ...campos, atualizadoEm: new Date().toISOString() };
      let dataFimNova = matriculas.matriculaAtualSync(registro.alunoId, tx)?.dataFim ?? null;
      // Só data, plano ou períodos refazem a renovação. Corrigir valor, forma ou
      // observação não toca na matrícula: refazê-la apagaria as cobranças do período.
      if (mudouPeriodo && (detalhe.alteraVencimento || (detalhe.matriculaId == null && planoId !== undefined))) {
        const pagamentoAnterior = tx.select({ id: pagamento.id }).from(pagamento).where(and(
          eq(pagamento.alunoId, registro.alunoId), lt(pagamento.id, pagamentoId),
          gt(pagamento.dataPagamento, atualizado.dataPagamento),
        )).get();
        if (pagamentoAnterior) throw new ErroNegocio('A data da renovação não pode ser antes do pagamento anterior do aluno.');
        const anterior = detalhe.matriculaId == null ? null
          : tx.select().from(matricula).where(eq(matricula.id, detalhe.matriculaId)).get()!;
        const planoAnterior = anterior ? tx.select().from(plano).where(eq(plano.id, anterior.planoId)).get() : null;
        const mesmoPlano = planoId === undefined || planoId === detalhe.planoId;
        const dataInicioEscolhida = mesmoPlano && planoAnterior?.duracaoDias != null
          && anterior!.dataInicio !== registro.dataPagamento ? anterior!.dataInicio : null;
        if (detalhe.alteraVencimento) excluirPagamentoEm(tx, pagamentoId);
        // Sem flags no legado, um fim diferente do cálculo original é manual.
        // Corrigir a data mantém essa escolha; trocar plano/períodos recalcula.
        let dataFimManual: string | null = null;
        if (anterior && mesmoPlano && (periodos === undefined || periodos === registro.periodos)) {
          const restaurada = matriculas.matriculaAtualSync(registro.alunoId, tx);
          const original = calcularRenovacao({
            dataFimAnterior: restaurada?.dataFim ?? null, diaAncoraAtual: restaurada?.diaAncora ?? null,
            dataPagamento: registro.dataPagamento, duracaoMeses: planoAnterior!.duracaoMeses * (registro.periodos ?? 1),
            duracaoDias: planoAnterior!.duracaoDias, dataInicioEscolhida,
          });
          if (anterior.dataFim !== original.dataFim) dataFimManual = anterior.dataFim;
        }
        atualizado.periodos = periodos ?? registro.periodos ?? 1;
        const nova = matriculas.renovarEm(tx, {
          alunoId: registro.alunoId, planoId: planoId ?? detalhe.planoId!,
          dataPagamento: atualizado.dataPagamento, periodos: atualizado.periodos,
          dataInicioEscolhida, dataFimManual,
          observacao: anterior?.observacao ?? undefined,
        }, periodos === undefined && registro.periodos != null);
        atualizado.matriculaId = nova.id;
        if (detalhe.alteraVencimento) tx.insert(pagamento).values(atualizado).run();
        else tx.update(pagamento).set(atualizado).where(eq(pagamento.id, pagamentoId)).run();
        if (registro.cobrancaId != null) tx.update(cobranca).set({ status: 'paga' })
          .where(eq(cobranca.id, registro.cobrancaId)).run();
        dataFimNova = nova.dataFim;
      } else {
        tx.update(pagamento).set(atualizado).where(eq(pagamento.id, pagamentoId)).run();
      }
      // A renovação pode excluir e recriar o pagamento; restaura também seus vínculos.
      if (vendasLigadas.length && formaVenda !== 'boleto') {
        tx.update(venda).set({ situacao: 'paga', forma: formaVenda, pagaEm: atualizado.dataPagamento,
          pagamentoId, atualizadoEm: new Date().toISOString(),
        }).where(inArray(venda.id, vendasLigadas.map((v) => v.id))).run();
      }
      const depois = pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0];
      tx.insert(pagamentoAlteracao).values({
        pagamentoId, alunoId: registro.alunoId, acao: 'editou', usuarioId,
        antes: estadoPagamento(detalhe), depois: estadoPagamento(depois),
      }).run();
      return { ok: true, pagamento: pagamentosDetalhados(eq(pagamento.id, pagamentoId), 1, tx)[0], dataFimNova };
    });
  }

  function alteracoes(filtro: { pagamentoId?: number; limite?: number } = {}) {
    return db.select({
      id: pagamentoAlteracao.id, acao: pagamentoAlteracao.acao, em: pagamentoAlteracao.em,
      usuarioNome: usuario.nome, alunoNome: aluno.nome, pagamentoId: pagamentoAlteracao.pagamentoId,
      antes: pagamentoAlteracao.antes, depois: pagamentoAlteracao.depois,
    }).from(pagamentoAlteracao)
      .innerJoin(aluno, eq(aluno.id, pagamentoAlteracao.alunoId))
      .leftJoin(usuario, eq(usuario.id, pagamentoAlteracao.usuarioId))
      .where(filtro.pagamentoId === undefined ? undefined : eq(pagamentoAlteracao.pagamentoId, filtro.pagamentoId))
      .orderBy(desc(pagamentoAlteracao.em), desc(pagamentoAlteracao.id)).limit(filtro.limite ?? 50).all();
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

  function historico(filtro: {
    mes?: string; de?: DataISO; ate?: DataISO; busca?: string; forma?: Forma;
    planoId?: number; pagina?: number; porPagina?: number;
  } = {}) {
    const busca = filtro.busca?.trim();
    const { mes, pagina = 1, porPagina = 50 } = filtro;
    const condicao = and(
      mes ? and(gte(pagamento.dataPagamento, `${mes}-01`),
        lt(pagamento.dataPagamento, adicionarMeses(`${mes}-01`, 1, 1))) : undefined,
      filtro.de ? gte(pagamento.dataPagamento, filtro.de) : undefined,
      filtro.ate ? lte(pagamento.dataPagamento, filtro.ate) : undefined,
      busca ? contemBusca(aluno.nome, busca) : undefined,
      filtro.forma ? eq(pagamento.forma, filtro.forma) : undefined,
      filtro.planoId !== undefined ? eq(matricula.planoId, filtro.planoId) : undefined,
    );
    const itens = pagamentosDetalhados(condicao, porPagina, db, (pagina - 1) * porPagina);
    const total = sql<number>`coalesce(sum(${pagamento.valorCentavos}), 0)`.mapWith(Number);
    const porForma = db.select({ forma: pagamento.forma, totalCentavos: total, quantidade: count() })
      .from(pagamento).innerJoin(aluno, eq(aluno.id, pagamento.alunoId))
      .leftJoin(matricula, eq(matricula.id, matriculaDoPagamento))
      .where(condicao).groupBy(pagamento.forma).orderBy(desc(total), pagamento.forma).all();
    const totalCentavos = porForma.reduce((soma, f) => soma + f.totalCentavos, 0);
    const quantidade = porForma.reduce((soma, f) => soma + f.quantidade, 0);
    const porDia = mes ? db.select({ data: pagamento.dataPagamento, totalCentavos: total })
      .from(pagamento).innerJoin(aluno, eq(aluno.id, pagamento.alunoId))
      .leftJoin(matricula, eq(matricula.id, matriculaDoPagamento))
      .where(condicao).groupBy(pagamento.dataPagamento).orderBy(pagamento.dataPagamento).all() : [];
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
      itens, totalCentavos, quantidade, porForma, porDia, meses,
      pagina, porPagina, totalPaginas: Math.ceil(quantidade / porPagina),
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
    registrarPagamento, excluirPagamento, editarPagamento, alteracoes, historico, cobrancasAbertas, pagamentosRecentes, pagamentosDoAluno,
    gerarCobrancasDevidas, pixDaCobranca, pixAvulso, receitaDoMes, recebidoEm, inadimplencia, distribuicaoPorPlano,
  };
}
