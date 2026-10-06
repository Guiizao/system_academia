import { eq, and, gte, desc, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { plano, matricula } from '../db/schema.js';
import { hoje, type DataISO } from '../dominio/datas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;

const MAX_MESES = 24;
const MAX_DIAS = 60;
const MAX_PRECO_CENTAVOS = 10_000_000;

export interface NovoPlano {
  nome: string;
  precoCentavos: number;
  duracaoMeses: number;
  /** preenchido = diária: vale N dias corridos e acaba, sem cobrança no mês seguinte */
  duracaoDias?: number | null;
  beneficios?: string[];
  destaque?: boolean;
}

export interface EdicaoPlano {
  nome?: string;
  precoCentavos?: number;
  duracaoMeses?: number;
  duracaoDias?: number | null;
  beneficios?: string[];
  destaque?: boolean;
  ativo?: boolean;
}

/**
 * Planos: a tabela de precos da academia, editavel de ponta a ponta.
 *
 * Tudo aqui mexe apenas no que sera vendido daqui para frente. Matricula e
 * pagamento guardam o valor e as datas que valiam na hora -- trocar o preco ou
 * a duracao de um plano nunca reescreve o que o aluno ja contratou.
 */
export function criarServicoPlanos(db: Db) {
  function buscar(id: number) {
    const p = db.select().from(plano).where(eq(plano.id, id)).limit(1).get();
    if (!p) throw new ErroNaoEncontrado(`Plano ${id} não encontrado`);
    return p;
  }

  function listar(todos = false) {
    const q = db.select().from(plano);
    return (todos ? q : q.where(eq(plano.ativo, true))).orderBy(plano.ordem, plano.id).all();
  }

  /** Quantas matriculas desse plano ainda estao valendo hoje. */
  function matriculasEmCurso(planoId: number, hojeISO: DataISO) {
    return db.select({ id: matricula.id }).from(matricula)
      .where(and(
        eq(matricula.planoId, planoId),
        eq(matricula.status, 'ativa'),
        gte(matricula.dataFim, hojeISO),
      )).all().length;
  }

  function validarNome(nome: string, ignorarId?: number) {
    const limpo = nome.trim();
    if (!limpo) throw new ErroNegocio('Dê um nome ao plano');
    if (limpo.length > 60) throw new ErroNegocio('O nome do plano passou de 60 letras');
    const igual = db.select({ id: plano.id, nome: plano.nome }).from(plano).all()
      .find((p) => p.nome.trim().toLowerCase() === limpo.toLowerCase() && p.id !== ignorarId);
    if (igual) throw new ErroNegocio(`Já existe um plano chamado "${igual.nome}"`);
    return limpo;
  }

  function validarPreco(centavos: number) {
    if (!Number.isInteger(centavos) || centavos <= 0) {
      throw new ErroNegocio('Preço inválido: informe um valor acima de zero');
    }
    if (centavos > MAX_PRECO_CENTAVOS) throw new ErroNegocio('Preço acima do limite');
    return centavos;
  }

  function validarDuracao(meses: number | undefined, dias: number | null | undefined) {
    if (dias != null) {
      if (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS) {
        throw new ErroNegocio(`Duração da diária: de 1 a ${MAX_DIAS} dias`);
      }
      return;
    }
    if (meses == null) return;
    if (!Number.isInteger(meses) || meses < 1 || meses > MAX_MESES) {
      throw new ErroNegocio(`Duração do plano: de 1 a ${MAX_MESES} meses`);
    }
  }

  function validarBeneficios(lista: string[]) {
    if (lista.length > 12) throw new ErroNegocio('No máximo 12 benefícios por plano');
    return lista.map((b) => b.trim()).filter(Boolean).map((b) => b.slice(0, 80));
  }

  function criar(d: NovoPlano) {
    const nome = validarNome(d.nome);
    validarPreco(d.precoCentavos);
    const ehDiaria = d.duracaoDias != null;
    validarDuracao(ehDiaria ? undefined : d.duracaoMeses, d.duracaoDias);

    const ultimo = db.select({ ordem: plano.ordem }).from(plano).orderBy(desc(plano.ordem)).limit(1).get();
    return db.insert(plano).values({
      nome,
      precoCentavos: d.precoCentavos,
      duracaoMeses: ehDiaria ? 0 : d.duracaoMeses,
      duracaoDias: ehDiaria ? d.duracaoDias : null,
      beneficios: validarBeneficios(d.beneficios ?? []),
      destaque: d.destaque ?? false,
      ordem: (ultimo?.ordem ?? 0) + 1,
    }).returning().get();
  }

  function atualizar(id: number, d: EdicaoPlano, hojeISO: DataISO = hoje()) {
    const atual = buscar(id);
    const campos: Partial<typeof plano.$inferInsert> = {};

    if (d.nome !== undefined) campos.nome = validarNome(d.nome, id);
    if (d.precoCentavos !== undefined) campos.precoCentavos = validarPreco(d.precoCentavos);
    if (d.beneficios !== undefined) campos.beneficios = validarBeneficios(d.beneficios);
    if (d.destaque !== undefined) campos.destaque = d.destaque;
    if (d.ativo !== undefined) campos.ativo = d.ativo;

    // mensalidade <-> diaria muda o significado de quem esta matriculado:
    // uma diaria nao gera cobranca no mes seguinte, e o aluno ficaria sem aviso.
    const viraDiaria = d.duracaoDias != null && atual.duracaoDias == null;
    const viraMensal = d.duracaoMeses != null && d.duracaoDias == null && atual.duracaoDias != null;
    if (viraDiaria || viraMensal) {
      const emCurso = matriculasEmCurso(id, hojeISO);
      if (emCurso > 0) {
        throw new ErroNegocio(
          `"${atual.nome}" tem ${emCurso === 1 ? '1 matrícula em curso' : `${emCurso} matrículas em curso`}. ` +
          'Para trocar entre mensalidade e diária, crie um plano novo e desative este.',
        );
      }
    }

    if (d.duracaoDias !== undefined || d.duracaoMeses !== undefined) {
      const diasAlvo = d.duracaoDias !== undefined
        ? d.duracaoDias
        : (viraMensal ? null : atual.duracaoDias);
      // sem dias e sem meses o plano fica sem prazo nenhum: a renovacao nao
      // teria o que somar e o aluno ficaria com vencimento no mesmo dia.
      if (diasAlvo == null) {
        const mesesAlvo = d.duracaoMeses ?? atual.duracaoMeses;
        validarDuracao(mesesAlvo, null);
        campos.duracaoMeses = mesesAlvo;
      } else {
        validarDuracao(undefined, diasAlvo);
      }
      if (diasAlvo != null) {
        campos.duracaoDias = diasAlvo;
        campos.duracaoMeses = 0;
      } else {
        campos.duracaoDias = null;
      }
    }

    if (!Object.keys(campos).length) return atual;
    campos.atualizadoEm = new Date().toISOString();
    return db.update(plano).set(campos).where(eq(plano.id, id)).returning().get();
  }

  /** Apaga de vez. So vale para plano que nunca foi vendido. */
  function excluir(id: number) {
    const p = buscar(id);
    const usos = db.select({ id: matricula.id }).from(matricula)
      .where(eq(matricula.planoId, id)).all().length;
    if (usos > 0) {
      throw new ErroNegocio(
        `"${p.nome}" já foi usado em ${usos === 1 ? '1 matrícula' : `${usos} matrículas`} e faz parte do ` +
        'histórico. Desative o plano: ele sai da lista de venda e o histórico continua inteiro.',
      );
    }
    db.delete(plano).where(eq(plano.id, id)).run();
    return { id, nome: p.nome };
  }

  /** Ordem em que os planos aparecem. Recebe os ids na sequencia desejada. */
  function reordenar(ids: number[]) {
    const existentes = new Set(db.select({ id: plano.id }).from(plano).all().map((p) => p.id));
    const faltando = ids.find((id) => !existentes.has(id));
    if (faltando !== undefined) throw new ErroNaoEncontrado(`Plano ${faltando} não encontrado`);
    if (new Set(ids).size !== ids.length) throw new ErroNegocio('Lista de ordem com id repetido');

    // quem nao veio na lista vai para o fim, em vez de disputar a mesma ordem
    const resto = listar(true).map((p) => p.id).filter((pid) => !ids.includes(pid));
    const sequencia = [...ids, ...resto];

    // tudo ou nada: ordem pela metade deixaria a lista embaralhada
    db.transaction((tx) => {
      sequencia.forEach((pid, i) => {
        tx.update(plano).set({ ordem: i + 1 }).where(eq(plano.id, pid)).run();
      });
    });
    return listar(true);
  }

  return { listar, criar, atualizar, excluir, reordenar };
}

export type ServicoPlanos = ReturnType<typeof criarServicoPlanos>;
