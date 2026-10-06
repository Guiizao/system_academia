import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigir, COOKIE_SESSAO } from '../plugins/autenticacao.js';
import type { Servicos } from '../servidor.js';

const id = z.coerce.number().int().positive();
const papel = z.enum(['dono', 'recepcao', 'professor']);

export function rotasEquipe(app: FastifyInstance, s: Servicos) {
  const dono = { preHandler: exigir('dono') };

  app.get('/api/usuarios', dono, async () => s.usuarios.listar());

  app.post('/api/usuarios', dono, async (req, reply) => {
    const d = z.object({
      nome: z.string().min(1), email: z.string(), papel, senhaInicial: z.string(),
      cref: z.string().optional(), especialidade: z.string().optional(), telefone: z.string().optional(),
    }).parse(req.body);
    return reply.status(201).send(await s.usuarios.criar(d));
  });

  app.put('/api/usuarios/:id', dono, async (req) => {
    const d = z.object({
      nome: z.string().min(1).optional(), papel: papel.optional(),
      cref: z.string().nullable().optional(), especialidade: z.string().nullable().optional(),
      telefone: z.string().nullable().optional(), ativo: z.boolean().optional(),
    }).parse(req.body);
    return s.usuarios.atualizar(id.parse((req.params as any).id), d, req.usuario!.id);
  });

  app.post('/api/usuarios/:id/senha', dono, async (req) => {
    const { novaSenha } = z.object({ novaSenha: z.string() }).parse(req.body);
    await s.usuarios.redefinirSenha(id.parse((req.params as any).id), novaSenha);
    return { ok: true };
  });

  // qualquer pessoa logada troca a propria senha
  app.post('/api/auth/senha', { preHandler: exigir() }, async (req) => {
    const d = z.object({ senhaAtual: z.string(), novaSenha: z.string() }).parse(req.body);
    await s.usuarios.trocarPropriaSenha(req.usuario!.id, d.senhaAtual, d.novaSenha, req.cookies?.[COOKIE_SESSAO]);
    return { ok: true };
  });

  app.get('/api/academia', dono, async () => s.academia.obter());

  app.put('/api/academia', dono, async (req) => {
    const t = z.string().optional();
    const d = z.object({
      nome: t, cnpj: t, endereco: t, telefone: t, whatsapp: t, instagram: t,
      pixChave: t, pixTipo: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
      pixNomeRecebedor: t, pixCidade: t,
      diasAvisoVencimento: z.number().int().optional(), diasAlunoSumido: z.number().int().optional(),
    }).parse(req.body);
    return s.academia.atualizar(d);
  });

  app.get('/api/avisos', { preHandler: exigir() }, async (req) => s.avisos.paraPapel(req.usuario!.papel as any));
}
