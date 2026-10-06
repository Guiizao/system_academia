import { eq, desc, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { fichaTreino, fichaDivisao, fichaItem, exercicio, usuario, aluno } from '../db/schema.js';
import { ErroNegocio, ErroNaoEncontrado, ErroPermissao } from './erros.js';

type Db = BetterSQLite3Database<any>;

export class ErroIaDesativada extends ErroNegocio {
  constructor() {
    super('Geração por IA está desativada nesta instalação.', 503);
  }
}

export function iaHabilitada(): boolean {
  return process.env.IA_HABILITADA === 'true';
}

export interface NovaFicha {
  alunoId: number;
  objetivo: string;
  nivel: string;
  diasPorSemana: number;
  divisoes: Array<{
    rotulo: string; foco: string;
    itens: Array<{ exercicioId: number; series: number; reps: string; descansoSeg: number; cargaOrientacao?: string }>;
  }>;
}

export function criarServicoFichas(db: Db) {
  /** Ficha manual nasce rascunho, como a da IA. Todo exercicio precisa existir. */
  function criar(dados: NovaFicha, criadoPorUsuarioId: number) {
    const al = db.select().from(aluno).where(eq(aluno.id, dados.alunoId)).get();
    if (!al) throw new ErroNaoEncontrado('Aluno não encontrado');

    const ids = [...new Set(dados.divisoes.flatMap((d) => d.itens.map((i) => i.exercicioId)))];
    if (ids.length) {
      const existentes = db.select().from(exercicio).where(inArray(exercicio.id, ids)).all();
      const faltando = ids.filter((id) => !existentes.some((e) => e.id === id));
      if (faltando.length) {
        throw new ErroNegocio(`Exercício fora da biblioteca: ${faltando.join(', ')}`);
      }
      // a tela promete: contraindicado nunca entra na ficha deste aluno.
      // Quem garante e o servidor, nao a tela.
      const proibidos = existentes.filter((e) => e.contraindicacoes.some((c) => al.restricoes.includes(c)));
      if (proibidos.length) {
        const nomes = proibidos.map((e) => `${e.nome} (${e.contraindicacoes.filter((c) => al.restricoes.includes(c)).join(', ')})`);
        throw new ErroNegocio(`Exercício contraindicado para ${al.nome}: ${nomes.join('; ')}`);
      }
    }

    return db.transaction((tx) => {
      const f = tx.insert(fichaTreino).values({
        alunoId: dados.alunoId, objetivo: dados.objetivo, nivel: dados.nivel,
        diasPorSemana: dados.diasPorSemana, status: 'rascunho', geradaPor: 'manual',
        criadoPorUsuarioId,
      }).returning().get();

      dados.divisoes.forEach((d, i) => {
        const div = tx.insert(fichaDivisao).values({
          fichaId: f.id, rotulo: d.rotulo, foco: d.foco, ordem: i + 1,
        }).returning().get();
        d.itens.forEach((it, j) => {
          tx.insert(fichaItem).values({ divisaoId: div.id, ordem: j + 1, ...it }).run();
        });
      });
      return f;
    });
  }

  /**
   * O aprovador e SEMPRE quem esta logado -- nao existe parametro
   * "aprovar em nome de".
   *
   * Prescricao de exercicio e privativa de profissional de Ed. Fisica
   * (Lei 9.696/1998). Decisao do dono (25/09/2026): o sistema AVISA, mas nao
   * bloqueia -- nem por falta de CREF, nem por papel. Quem responde pela
   * academia e ele. Qualquer pessoa logada libera, inclusive a recepcao.
   * Em troca, a ficha guarda quem liberou e o CREF que essa pessoa tinha na
   * hora: sem CREF grava null, e a tela mostra a ficha como liberada sem CREF.
   * Nao inventar assinatura: string vazia viraria selo falso de conformidade.
   */
  function aprovar(fichaId: number, usuarioLogadoId: number) {
    const u = db.select().from(usuario).where(eq(usuario.id, usuarioLogadoId)).get();
    if (!u) throw new ErroPermissao('Usuário inválido');

    const f = db.select().from(fichaTreino).where(eq(fichaTreino.id, fichaId)).get();
    if (!f) throw new ErroNaoEncontrado('Ficha não encontrada');
    if (f.status !== 'rascunho') throw new ErroNegocio('Só rascunhos podem ser liberados');

    return db.update(fichaTreino).set({
      status: 'aprovada',
      aprovadaPorUsuarioId: u.id,
      aprovadaCref: u.cref?.trim() || null,
      aprovadaEm: new Date().toISOString(),
    }).where(eq(fichaTreino.id, fichaId)).returning().get();
  }

  function gerarComIA(): never {
    // Desativado ate haver veredito sobre a funcionalidade.
    throw new ErroIaDesativada();
  }

  /** Ficha completa, com divisoes e itens ja resolvidos. */
  function detalhar(fichaId: number) {
    const f = db.select().from(fichaTreino).where(eq(fichaTreino.id, fichaId)).get();
    if (!f) return null;
    const aprovador = f.aprovadaPorUsuarioId
      ? db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, f.aprovadaPorUsuarioId)).get()
      : null;
    const divisoes = db.select().from(fichaDivisao).where(eq(fichaDivisao.fichaId, f.id))
      .orderBy(fichaDivisao.ordem).all();

    return {
      ...f,
      aprovadaPorNome: aprovador?.nome ?? null,
      divisoes: divisoes.map((d) => ({
        ...d,
        itens: db.select({
          ordem: fichaItem.ordem, series: fichaItem.series, reps: fichaItem.reps,
          descansoSeg: fichaItem.descansoSeg, cargaOrientacao: fichaItem.cargaOrientacao,
          exercicioId: exercicio.id, exercicioNome: exercicio.nome, equipamento: exercicio.equipamento,
        }).from(fichaItem)
          .innerJoin(exercicio, eq(exercicio.id, fichaItem.exercicioId))
          .where(eq(fichaItem.divisaoId, d.id))
          .orderBy(fichaItem.ordem).all(),
      })),
    };
  }

  function listar(alunoId?: number) {
    const q = db.select({ id: fichaTreino.id }).from(fichaTreino);
    const linhas = (alunoId ? q.where(eq(fichaTreino.alunoId, alunoId)) : q)
      .orderBy(desc(fichaTreino.criadoEm)).all();
    return linhas.map((l) => detalhar(l.id)!);
  }

  return { criar, aprovar, gerarComIA, detalhar, listar };
}
