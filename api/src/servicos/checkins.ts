import { eq, and, desc, like, count } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { checkin, aluno } from '../db/schema.js';
import { dataLocalDe, type DataISO } from '../dominio/datas.js';
import { intervaloDeCheckin, MINUTOS_ENTRE_CHECKINS } from '../dominio/checkin.js';
import { ErroNegocio } from './erros.js';

type Db = BetterSQLite3Database<any>;

export function criarServicoCheckins(db: Db) {
  function registrar(args: {
    alunoId: number; atividade: string;
    origem?: 'manual' | 'qr' | 'catraca'; usuarioId?: number; agora?: Date;
  }) {
    const a = db.select({ id: aluno.id }).from(aluno).where(eq(aluno.id, args.alunoId)).get();
    if (!a) throw new Error('Aluno não encontrado');

    const agora = args.agora ?? new Date();
    // Botao apertado varias vezes, recepcao e celular ao mesmo tempo: sem este
    // freio a mesma entrada vira varias e a contagem do mes perde o sentido.
    const intervalo = intervaloDeCheckin(ultimoDe(args.alunoId)?.dataHora ?? null, agora);
    if (!intervalo.liberado) {
      throw new ErroNegocio(
        `Este aluno já fez check-in agora há pouco. O próximo pode ser daqui a ${intervalo.faltamMinutos} `
        + `minuto${intervalo.faltamMinutos === 1 ? '' : 's'} (um a cada ${MINUTOS_ENTRE_CHECKINS} minutos).`,
        409,
      );
    }

    return db.insert(checkin).values({
      alunoId: args.alunoId,
      atividade: args.atividade,
      origem: args.origem ?? 'manual',
      registradoPorUsuarioId: args.usuarioId,
      dataHora: agora.toISOString(),
      dataLocal: dataLocalDe(agora),
    }).returning().get();
  }

  function doDia(dataLocal: DataISO) {
    return db.select().from(checkin)
      .where(eq(checkin.dataLocal, dataLocal))
      .orderBy(desc(checkin.dataHora)).all();
  }

  function recentes(limite = 10) {
    return db.select().from(checkin).orderBy(desc(checkin.dataHora)).limit(limite).all();
  }

  function doAluno(alunoId: number, limite = 60) {
    return db.select().from(checkin)
      .where(eq(checkin.alunoId, alunoId))
      .orderBy(desc(checkin.dataHora)).limit(limite).all();
  }

  /** mes no formato 'YYYY-MM' */
  function contagemNoMes(alunoId: number, mes: string): number {
    return db.select({ n: count() }).from(checkin)
      .where(and(eq(checkin.alunoId, alunoId), like(checkin.dataLocal, `${mes}-%`)))
      .get()?.n ?? 0;
  }

  function ultimoDe(alunoId: number) {
    return db.select().from(checkin).where(eq(checkin.alunoId, alunoId))
      .orderBy(desc(checkin.dataHora)).limit(1).get() ?? null;
  }

  return { registrar, doDia, recentes, doAluno, contagemNoMes, ultimoDe };
}
