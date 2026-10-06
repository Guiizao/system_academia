import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UsuarioPublico } from '../servicos/auth.js';
import { criarServicoAuth } from '../servicos/auth.js';

export const COOKIE_SESSAO = 'df_sessao';
export type Papel = 'dono' | 'recepcao' | 'professor';

declare module 'fastify' {
  interface FastifyRequest { usuario: UsuarioPublico | null }
}

export function registrarAutenticacao(app: FastifyInstance, auth: ReturnType<typeof criarServicoAuth>) {
  app.decorateRequest('usuario', null);
  app.addHook('onRequest', async (req) => {
    const token = req.cookies?.[COOKIE_SESSAO]
      ?? req.headers.authorization?.replace(/^Bearer /, '');
    req.usuario = auth.usuarioDaSessao(token);
  });
}

/** Guarda de rota: exige login e, opcionalmente, um dos papeis. */
export function exigir(...papeis: Papel[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.usuario) return reply.status(401).send({ erro: 'Faça login para continuar' });
    if (papeis.length && !papeis.includes(req.usuario.papel as Papel)) {
      return reply.status(403).send({ erro: 'Seu perfil não tem acesso a isto' });
    }
  };
}
