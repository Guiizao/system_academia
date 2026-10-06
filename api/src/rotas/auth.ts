import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { COOKIE_SESSAO, exigir } from '../plugins/autenticacao.js';
import { criarLimitador } from '../dominio/limitador.js';
import { ErroExcessoDeTentativas } from '../servicos/erros.js';
import type { Servicos } from '../servidor.js';

/**
 * Limites do login. O bloqueio por e-mail (servicos/auth.ts) nao cobre quem
 * troca o e-mail a cada tentativa, nem o custo de CPU: toda tentativa roda
 * argon2, que e lento de proposito. Sem teto, umas poucas dezenas de chamadas
 * por segundo travam o notebook da academia sem acertar senha nenhuma.
 */
const POR_IP = { max: 10, janelaMs: 60_000 };
/** teto do servidor inteiro: segura ataque distribuido e protege a CPU */
const GLOBAL = { max: 40, janelaMs: 60_000 };
const CHAVE_GLOBAL = '*';

export function rotasAuth(app: FastifyInstance, s: Servicos) {
  const porIp = criarLimitador(POR_IP);
  const global = criarLimitador(GLOBAL);

  /** IP de quem chamou. Atras do tunel vem no X-Forwarded-For, e o Fastify so
   *  aceita esse cabecalho vindo do loopback (trustProxy do servidor). */
  const deOndeVeio = (req: FastifyRequest) => req.ip || 'desconhecido';

  app.post('/api/auth/login', async (req, reply) => {
    const ip = deOndeVeio(req);
    const noGeral = global.tentar(CHAVE_GLOBAL);
    if (!noGeral.ok) {
      throw new ErroExcessoDeTentativas(
        'O sistema está recebendo tentativas demais agora. Tente de novo em instantes.', noGeral.esperarSeg);
    }
    const desteIp = porIp.tentar(ip);
    if (!desteIp.ok) {
      throw new ErroExcessoDeTentativas(
        `Muitas tentativas deste aparelho. Tente de novo em ${desteIp.esperarSeg}s.`, desteIp.esperarSeg);
    }

    const { email, senha } = z.object({ email: z.string(), senha: z.string() }).parse(req.body);
    const r = await s.auth.login(email, senha);

    // entrou: o aparelho volta a ter as tentativas cheias
    porIp.esquecer(ip);

    reply.setCookie(COOKIE_SESSAO, r.token, {
      path: '/', httpOnly: true, sameSite: 'lax',
      // Secure so atras de HTTPS (tunel); na rede local o acesso e HTTP.
      // req.protocol ja resolve a cadeia de proxy confiavel -- ler o cabecalho
      // cru erraria quando ele vem com mais de um valor ("https, http").
      secure: req.protocol === 'https',
      maxAge: 12 * 60 * 60,
    });
    return { usuario: r.usuario, token: r.token };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies?.[COOKIE_SESSAO];
    if (token) s.auth.logout(token);
    reply.clearCookie(COOKIE_SESSAO, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/eu', { preHandler: exigir() }, async (req) => ({ usuario: req.usuario }));
}
