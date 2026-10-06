import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { count } from 'drizzle-orm';
import { exercicio, tagRestricao } from './schema.js';
import { EXERCICIOS, TAGS_RESTRICAO } from './seed-dados.js';

type Db = BetterSQLite3Database<any>;

/**
 * Biblioteca de exercicios e tags de restricao: dado de referencia, nao de
 * demonstracao. Sem ela a instalacao real nao monta ficha nenhuma.
 * So preenche tabela vazia: nao duplica nem reativa o que o dono desativou.
 */
export function garantirCatalogo(db: Db) {
  const vazia = (t: typeof exercicio | typeof tagRestricao) => (db.select({ n: count() }).from(t).get()?.n ?? 0) === 0;
  db.transaction((tx) => {
    if (vazia(tagRestricao)) {
      for (const [codigo, rotulo] of TAGS_RESTRICAO) tx.insert(tagRestricao).values({ codigo, rotulo }).run();
    }
    if (vazia(exercicio)) {
      for (const [nome, grupo, padrao, equip, nivel, contra] of EXERCICIOS) {
        tx.insert(exercicio).values({
          nome, grupoMuscular: grupo, padraoMovimento: padrao, equipamento: equip,
          nivelMinimo: nivel, contraindicacoes: contra,
        }).run();
      }
    }
  });
}
