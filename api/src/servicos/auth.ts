import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { usuario, sessao } from '../db/schema.js';
import { ErroNegocio } from './erros.js';

type Db = BetterSQLite3Database<any>;

const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;   // 12h
const MAX_TENTATIVAS = 5;
const BLOQUEIO_BASE_MS = 60_000;                  // 1 min, dobrando

export class ErroAutenticacao extends ErroNegocio {
  constructor(message = 'E-mail ou senha incorretos') { super(message, 401); }
}

export function hashSenha(senha: string) {
  return argon2.hash(senha, { type: argon2.argon2id });
}

/** Usuario sem o hash -- nunca devolver senhaHash para fora. */
function publico(u: typeof usuario.$inferSelect) {
  const { senhaHash: _, ...resto } = u;
  return resto;
}

export function criarServicoAuth(db: Db) {
  // Falhas por e-mail. Em memoria: reinicia com o servidor, suficiente
  // para frear forca bruta sem tabela extra.
  const falhas = new Map<string, { n: number; bloqueadoAte: number }>();

  async function login(email: string, senha: string, agora = Date.now()) {
    const chave = (email ?? '').trim().toLowerCase();
    const f = falhas.get(chave);
    if (f && f.bloqueadoAte > agora) {
      const seg = Math.ceil((f.bloqueadoAte - agora) / 1000);
      throw new ErroAutenticacao(`Muitas tentativas. Tente de novo em ${seg}s.`);
    }

    const u = db.select().from(usuario).where(eq(usuario.email, chave)).get();
    // verifica mesmo quando o usuario nao existe: nao vaza, pelo tempo de
    // resposta, quais e-mails estao cadastrados
    const ok = u?.senhaHash && u.ativo
      ? await argon2.verify(u.senhaHash, senha ?? '')
      : (await argon2.hash('x'), false);

    if (!ok || !u) {
      const n = (f?.n ?? 0) + 1;
      const bloqueio = n >= MAX_TENTATIVAS ? BLOQUEIO_BASE_MS * 2 ** (n - MAX_TENTATIVAS) : 0;
      falhas.set(chave, { n, bloqueadoAte: agora + bloqueio });
      throw new ErroAutenticacao();
    }

    falhas.delete(chave);
    const token = randomBytes(32).toString('hex');
    db.insert(sessao).values({
      token, usuarioId: u.id,
      expiraEm: new Date(agora + DURACAO_SESSAO_MS).toISOString(),
    }).run();
    db.update(usuario).set({ ultimoLogin: new Date(agora).toISOString() }).where(eq(usuario.id, u.id)).run();

    return { token, usuario: publico(u) };
  }

  function usuarioDaSessao(token: string | undefined, agora = Date.now()) {
    if (!token) return null;
    const linha = db.select({ u: usuario }).from(sessao)
      .innerJoin(usuario, eq(usuario.id, sessao.usuarioId))
      .where(and(eq(sessao.token, token), gt(sessao.expiraEm, new Date(agora).toISOString())))
      .get();
    return linha?.u.ativo ? publico(linha.u) : null;
  }

  function logout(token: string) {
    db.delete(sessao).where(eq(sessao.token, token)).run();
  }

  return { login, usuarioDaSessao, logout };
}

export type UsuarioPublico = NonNullable<ReturnType<ReturnType<typeof criarServicoAuth>['usuarioDaSessao']>>;
