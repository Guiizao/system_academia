import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { count } from 'drizzle-orm';
import { usuario, academia, plano } from '../db/schema.js';
import { hashSenha } from './auth.js';
import { ErroNegocio } from './erros.js';
import { PLANOS } from '../db/seed-dados.js';
import { garantirCatalogo } from '../db/catalogo.js';

type Db = BetterSQLite3Database<any>;

export function precisaConfigurar(db: Db): boolean {
  return (db.select({ n: count() }).from(usuario).get()?.n ?? 0) === 0;
}

/**
 * Instalacao real: o dono cria a PROPRIA conta. So funciona com banco vazio,
 * para nunca virar porta dos fundos de criar dono num sistema em uso.
 */
export async function configurarPrimeiroAcesso(db: Db, d: {
  nomeAcademia: string; nome: string; email: string; senha: string;
}) {
  if (!precisaConfigurar(db)) throw new ErroNegocio('O sistema já foi configurado', 409);
  if (!d.nomeAcademia?.trim() || !d.nome?.trim()) throw new ErroNegocio('Preencha o nome da academia e o seu');
  if (!/^\S+@\S+\.\S+$/.test(d.email ?? '')) throw new ErroNegocio('E-mail inválido');
  if ((d.senha ?? '').length < 10) throw new ErroNegocio('A senha precisa ter pelo menos 10 caracteres');

  const senhaHash = await hashSenha(d.senha);
  db.transaction((tx) => {
    tx.insert(academia).values({ nome: d.nomeAcademia.trim(), responsavel: d.nome.trim() }).run();
    tx.insert(usuario).values({
      nome: d.nome.trim(), email: d.email.trim().toLowerCase(), papel: 'dono', senhaHash,
    }).run();
    for (const p of PLANOS) tx.insert(plano).values(p).run();
  });
  garantirCatalogo(db);
}
