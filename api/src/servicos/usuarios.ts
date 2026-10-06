import argon2 from 'argon2';
import { eq, and, ne, count } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { usuario, sessao } from '../db/schema.js';
import { hashSenha } from './auth.js';
import { ErroNegocio, ErroNaoEncontrado, ErroPermissao } from './erros.js';

type Db = BetterSQLite3Database<any>;
type Papel = 'dono' | 'recepcao' | 'professor';

const SENHA_MINIMA = 10;

function publico(u: typeof usuario.$inferSelect) {
  const { senhaHash: _, ...resto } = u;
  return resto;
}

function validarSenha(s: string) {
  if ((s ?? '').length < SENHA_MINIMA) throw new ErroNegocio(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`);
}

export function criarServicoUsuarios(db: Db) {
  function listar() {
    return db.select().from(usuario).orderBy(usuario.nome).all().map(publico);
  }

  function donosAtivos(excetoId?: number): number {
    const cond = excetoId
      ? and(eq(usuario.papel, 'dono'), eq(usuario.ativo, true), ne(usuario.id, excetoId))
      : and(eq(usuario.papel, 'dono'), eq(usuario.ativo, true));
    return db.select({ n: count() }).from(usuario).where(cond).get()?.n ?? 0;
  }

  async function criar(d: {
    nome: string; email: string; papel: Papel; senhaInicial: string;
    cref?: string; especialidade?: string; telefone?: string;
  }) {
    if (!d.nome?.trim()) throw new ErroNegocio('Nome é obrigatório');
    const email = (d.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ErroNegocio('E-mail inválido');
    validarSenha(d.senhaInicial);
    if (db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email)).get()) {
      throw new ErroNegocio('Já existe um usuário com este e-mail');
    }
    const u = db.insert(usuario).values({
      nome: d.nome.trim(), email, papel: d.papel,
      cref: d.cref?.trim() || null, especialidade: d.especialidade?.trim() || null,
      telefone: d.telefone?.trim() || null,
      senhaHash: await hashSenha(d.senhaInicial),
    }).returning().get();
    return publico(u);
  }

  /**
   * Dono edita papel, CREF e ativo. Duas travas: ninguem se desativa (evita
   * trancar a si mesmo para fora) e o sistema nunca fica sem dono ativo --
   * senao nao sobra ninguem para administrar.
   */
  function atualizar(id: number, d: {
    nome?: string; papel?: Papel; cref?: string | null; especialidade?: string | null;
    telefone?: string | null; ativo?: boolean;
  }, quemAlteraId: number) {
    const atual = db.select().from(usuario).where(eq(usuario.id, id)).get();
    if (!atual) throw new ErroNaoEncontrado('Usuário não encontrado');
    if (id === quemAlteraId && d.ativo === false) throw new ErroPermissao('Você não pode desativar a si mesmo');

    const deixaDeSerDonoAtivo = atual.papel === 'dono' && atual.ativo &&
      ((d.papel && d.papel !== 'dono') || d.ativo === false);
    if (deixaDeSerDonoAtivo && donosAtivos(id) === 0) {
      throw new ErroNegocio('O sistema precisa de pelo menos um dono ativo');
    }

    const mudancas: Partial<typeof usuario.$inferInsert> = {};
    if (d.nome !== undefined) mudancas.nome = d.nome.trim();
    if (d.papel !== undefined) mudancas.papel = d.papel;
    if (d.cref !== undefined) mudancas.cref = d.cref?.trim() || null;
    if (d.especialidade !== undefined) mudancas.especialidade = d.especialidade?.trim() || null;
    if (d.telefone !== undefined) mudancas.telefone = d.telefone?.trim() || null;
    if (d.ativo !== undefined) mudancas.ativo = d.ativo;
    mudancas.atualizadoEm = new Date().toISOString();

    const u = db.update(usuario).set(mudancas).where(eq(usuario.id, id)).returning().get();
    // desativado: derruba as sessoes abertas na hora
    if (d.ativo === false) db.delete(sessao).where(eq(sessao.usuarioId, id)).run();
    return publico(u);
  }

  /** Dono redefine a senha de alguem (esqueceu). Derruba as sessoes dessa pessoa. */
  async function redefinirSenha(id: number, novaSenha: string) {
    validarSenha(novaSenha);
    const u = db.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, id)).get();
    if (!u) throw new ErroNaoEncontrado('Usuário não encontrado');
    db.update(usuario).set({ senhaHash: await hashSenha(novaSenha) }).where(eq(usuario.id, id)).run();
    db.delete(sessao).where(eq(sessao.usuarioId, id)).run();
  }

  /** A propria pessoa troca a senha. Exige a atual; derruba as OUTRAS sessoes. */
  async function trocarPropriaSenha(id: number, senhaAtual: string, novaSenha: string, tokenAtual?: string) {
    const u = db.select().from(usuario).where(eq(usuario.id, id)).get();
    if (!u?.senhaHash || !(await argon2.verify(u.senhaHash, senhaAtual ?? ''))) {
      throw new ErroNegocio('Senha atual incorreta');
    }
    validarSenha(novaSenha);
    if (senhaAtual === novaSenha) throw new ErroNegocio('A nova senha precisa ser diferente da atual');
    db.update(usuario).set({ senhaHash: await hashSenha(novaSenha) }).where(eq(usuario.id, id)).run();
    const outras = db.select().from(sessao).where(eq(sessao.usuarioId, id)).all()
      .filter((s) => s.token !== tokenAtual);
    for (const s of outras) db.delete(sessao).where(eq(sessao.id, s.id)).run();
  }

  return { listar, criar, atualizar, redefinirSenha, trocarPropriaSenha };
}
