import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { exigir } from '../plugins/autenticacao.js';
import { exercicio, usuario, academia } from '../db/schema.js';
import { iaHabilitada } from '../servicos/fichas.js';
import { hoje } from '../dominio/datas.js';
import type { Servicos } from '../servidor.js';

const id = z.coerce.number().int().positive();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function rotasOperacao(app: FastifyInstance, s: Servicos) {
  const todos = { preHandler: exigir() };
  const treino = { preHandler: exigir('dono', 'professor') };

  app.get('/api/dashboard', todos, async (req) => {
    const r = s.dashboard.resumo();
    // Matriz de permissoes (spec 5.6): so o dono ve o financeiro consolidado.
    // O servidor REMOVE os campos -- esconder na tela nao e permissao.
    if (req.usuario!.papel !== 'dono') {
      const { receitaMesCentavos: _a, recebidoHojeCentavos: _b, inadimplenciaCentavos: _c, ...resto } = r;
      return resto;
    }
    return r;
  });

  app.get('/api/aulas', todos, async (req) => {
    const q = z.object({ data: data.optional() }).parse(req.query);
    return s.aulas.doDia(q.data ?? hoje());
  });

  app.post('/api/aulas', { preHandler: exigir('dono', 'professor') }, async (req, reply) => {
    const d = z.object({
      nome: z.string().min(1), diaSemana: z.number().int().min(0).max(6),
      hora: z.string().regex(/^\d{2}:\d{2}$/), duracaoMin: z.number().int().positive().optional(),
      professorUsuarioId: z.number().int().positive().optional(),
      vagas: z.number().int().positive(), local: z.string().optional(),
    }).parse(req.body);
    return reply.status(201).send(s.aulas.criar(d));
  });

  app.get('/api/aulas/:id/inscricoes', todos, async (req) => {
    const q = z.object({ data }).parse(req.query);
    return s.aulas.alunosInscritos(id.parse((req.params as any).id), q.data);
  });

  app.put('/api/aulas/:id', { preHandler: exigir('dono', 'professor') }, async (req) => {
    const d = z.object({
      ativo: z.boolean().optional(), vagas: z.number().int().positive().optional(),
      hora: z.string().regex(/^\d{2}:\d{2}$/).optional(), local: z.string().optional(),
    }).parse(req.body);
    return s.aulas.atualizar(id.parse((req.params as any).id), d);
  });

  app.post('/api/aulas/:id/inscricoes', todos, async (req, reply) => {
    const d = z.object({ alunoId: z.number().int().positive(), data }).parse(req.body);
    return reply.status(201).send(s.aulas.inscrever(id.parse((req.params as any).id), d.alunoId, d.data));
  });

  app.get('/api/exercicios', todos, async () =>
    s.db.select().from(exercicio).where(eq(exercicio.ativo, true)).orderBy(exercicio.nome).all());

  app.get('/api/fichas', todos, async () => s.fichas.listar());

  app.post('/api/fichas', treino, async (req, reply) => {
    const item = z.object({
      exercicioId: z.number().int().positive(), series: z.number().int().positive(),
      reps: z.string().min(1), descansoSeg: z.number().int().min(0),
      cargaOrientacao: z.string().optional(),
    });
    const d = z.object({
      alunoId: z.number().int().positive(), objetivo: z.string(), nivel: z.string(),
      diasPorSemana: z.number().int().min(1).max(7),
      divisoes: z.array(z.object({ rotulo: z.string(), foco: z.string(), itens: z.array(item).min(1) })).min(1),
    }).parse(req.body);
    return reply.status(201).send(s.fichas.criar(d, req.usuario!.id));
  });

  // Aprovador = quem esta logado, qualquer papel (montar a ficha continua sendo
  // de dono e professor). Sem CREF a ficha fica marcada como liberada sem CREF.
  app.post('/api/fichas/:id/aprovar', todos, async (req) =>
    s.fichas.aprovar(id.parse((req.params as any).id), req.usuario!.id));

  app.post('/api/fichas/gerar', treino, async () => s.fichas.gerarComIA());

  app.get('/api/config', todos, async () => ({
    academia: s.db.select().from(academia).limit(1).get(),
    iaHabilitada: iaHabilitada(),
    equipe: s.db.select({
      id: usuario.id, nome: usuario.nome, papel: usuario.papel, cref: usuario.cref,
      especialidade: usuario.especialidade,
    }).from(usuario).where(eq(usuario.ativo, true)).all(),
  }));
}
