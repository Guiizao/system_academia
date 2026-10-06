import { eq, and, count, ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { aula, inscricaoAula, usuario, aluno } from '../db/schema.js';
import { type DataISO } from '../dominio/datas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;

function diaDaSemana(data: DataISO): number {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function criarServicoAulas(db: Db) {
  function inscritos(aulaId: number, data: DataISO, q: Db = db): number {
    return q.select({ n: count() }).from(inscricaoAula)
      .where(and(eq(inscricaoAula.aulaId, aulaId), eq(inscricaoAula.data, data),
                 ne(inscricaoAula.status, 'cancelado'))).get()?.n ?? 0;
  }

  /** Aulas de uma DATA REAL, com a ocupacao daquela data. */
  function doDia(data: DataISO) {
    return db.select({
      id: aula.id, nome: aula.nome, hora: aula.hora, duracaoMin: aula.duracaoMin,
      vagas: aula.vagas, local: aula.local, professorNome: usuario.nome,
    }).from(aula)
      .leftJoin(usuario, eq(usuario.id, aula.professorUsuarioId))
      .where(and(eq(aula.diaSemana, diaDaSemana(data)), eq(aula.ativo, true)))
      .orderBy(aula.hora).all()
      .map((a) => ({ ...a, data, inscritos: inscritos(a.id, data) }));
  }

  function listar() {
    return db.select().from(aula).where(eq(aula.ativo, true)).orderBy(aula.diaSemana, aula.hora).all();
  }

  function criar(dados: typeof aula.$inferInsert) {
    if (!dados.nome?.trim()) throw new ErroNegocio('Nome da aula é obrigatório');
    if (!(dados.vagas > 0)) throw new ErroNegocio('Vagas deve ser maior que zero');
    return db.insert(aula).values(dados).returning().get();
  }

  /** Inscricao por aluno + data. Respeita vagas; duplicada e erro. */
  function inscrever(aulaId: number, alunoId: number, data: DataISO) {
    return db.transaction((tx) => {
      const t = tx as unknown as Db;
      const a = t.select().from(aula).where(eq(aula.id, aulaId)).get();
      if (!a) throw new ErroNaoEncontrado('Aula não encontrada');
      if (a.diaSemana !== diaDaSemana(data)) throw new ErroNegocio('Esta aula não acontece nessa data');
      if (!t.select({ id: aluno.id }).from(aluno).where(eq(aluno.id, alunoId)).get()) {
        throw new ErroNaoEncontrado('Aluno não encontrado');
      }
      if (inscritos(aulaId, data, t) >= a.vagas) throw new ErroNegocio('Aula lotada');

      try {
        return t.insert(inscricaoAula).values({ aulaId, alunoId, data }).returning().get();
      } catch (e: any) {
        if (String(e.message).includes('UNIQUE')) throw new ErroNegocio('Aluno já inscrito nesta aula');
        throw e;
      }
    });
  }

  /** Ids dos alunos ja inscritos numa sessao: a tela marca e nao oferece de novo. */
  function alunosInscritos(aulaId: number, data: DataISO): number[] {
    return db.select({ id: inscricaoAula.alunoId }).from(inscricaoAula)
      .where(and(eq(inscricaoAula.aulaId, aulaId), eq(inscricaoAula.data, data),
                 ne(inscricaoAula.status, 'cancelado'))).all().map((r) => r.id);
  }

  function atualizar(id: number, d: Partial<typeof aula.$inferInsert>) {
    if (!db.select({ id: aula.id }).from(aula).where(eq(aula.id, id)).get()) throw new ErroNaoEncontrado('Aula não encontrada');
    return db.update(aula).set({ ...d, atualizadoEm: new Date().toISOString() }).where(eq(aula.id, id)).returning().get();
  }

  return { doDia, listar, criar, atualizar, inscrever, inscritos, alunosInscritos };
}
