import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigir } from '../plugins/autenticacao.js';
import type { Servicos } from '../servidor.js';
import { ErroPermissao } from '../servicos/erros.js';

const id = z.coerce.number().int().positive();

export function rotasAlunos(app: FastifyInstance, s: Servicos) {
  const todos = { preHandler: exigir() };

  app.get('/api/alunos', todos, async (req) => {
    const q = z.object({
      busca: z.string().optional(),
      status: z.enum(['todos', 'ativo', 'vencendo', 'vencido', 'inativo']).optional(),
    }).parse(req.query);
    return s.alunos.listar(q);
  });

  app.get('/api/alunos/:id', todos, async (req, reply) => {
    const a = s.alunos.obter(id.parse((req.params as any).id));
    return a ?? reply.status(404).send({ erro: 'Aluno não encontrado' });
  });

  app.post('/api/alunos', todos, async (req, reply) => {
    const d = z.object({
      nome: z.string().min(1), telefone: z.string().min(8),
      email: z.string().email().optional().or(z.literal('')),
      cpf: z.string().optional(), dataNascimento: z.string().optional(),
      sexo: z.string().optional(), endereco: z.string().optional(),
      observacoesMedicas: z.string().optional(),
      restricoes: z.array(z.string().trim().max(40)).max(20).optional(),
      aceitaWhatsapp: z.boolean().optional(),
      consentimentoLgpd: z.boolean(),
      planoId: z.number().int().positive().optional(),
      formaPagamento: z.enum(['pix', 'dinheiro', 'credito', 'debito', 'boleto']).optional(),
    }).parse(req.body);

    if (d.planoId && d.formaPagamento && req.usuario!.papel === 'professor') {
      throw new ErroPermissao('Professor não registra pagamento');
    }
    const novo = s.alunos.criar(d, d.planoId && d.formaPagamento ? {
      planoId: d.planoId, forma: d.formaPagamento, usuarioId: req.usuario!.id,
    } : undefined);
    return reply.status(201).send(s.alunos.obter(novo.id));
  });

  app.put('/api/alunos/:id', todos, async (req) => {
    const d = z.object({
      nome: z.string().optional(), telefone: z.string().optional(),
      email: z.string().optional(), cpf: z.string().optional(),
      dataNascimento: z.string().optional(), sexo: z.string().optional(), endereco: z.string().optional(),
      observacoesMedicas: z.string().optional(), restricoes: z.array(z.string().trim().max(40)).max(20).optional(),
      observacao: z.string().trim().max(500).optional(),
      aceitaWhatsapp: z.boolean().optional(), ativo: z.boolean().optional(),
    }).parse(req.body);
    // Desativar ou reativar cadastro é decisão de caixa, não de professor.
    if (d.ativo !== undefined && req.usuario!.papel === 'professor') {
      throw new ErroPermissao(d.ativo ? 'Professor não reativa aluno' : 'Professor não desativa aluno');
    }
    return s.alunos.atualizar(id.parse((req.params as any).id), d);
  });

  app.post('/api/alunos/:id/inativar', todos, async (req) => {
    if (req.usuario!.papel === 'professor') {
      throw new ErroPermissao('Professor não marca aluno como inativo');
    }
    return s.alunos.inativar(id.parse((req.params as any).id));
  });

  app.get('/api/alunos/:id/periodos', { preHandler: exigir('dono', 'recepcao') }, async (req) =>
    s.alunos.periodos(id.parse((req.params as any).id)));

  app.get('/api/alunos/:id/avaliacoes', todos, async (req) =>
    s.alunos.avaliacoes(id.parse((req.params as any).id)));

  app.post('/api/alunos/:id/avaliacoes', todos, async (req, reply) => {
    const n = z.number().positive().optional();
    const d = z.object({
      data: z.string().optional(), pesoKg: n, alturaM: n, percGordura: n,
      circBraco: n, circPeito: n, circCintura: n, circQuadril: n, circCoxa: n, circOmbros: n,
      objetivo: z.enum(['hipertrofia','emagrecimento','definicao','condicionamento','saude_geral','reabilitacao']).optional(),
      nivel: z.enum(['iniciante','intermediario','avancado']).optional(),
      observacoes: z.string().optional(),
    }).parse(req.body);
    return reply.status(201).send(s.alunos.registrarAvaliacao({
      ...d, alunoId: id.parse((req.params as any).id),
      data: d.data || undefined, avaliadorUsuarioId: req.usuario!.id,
    } as any));
  });

  app.get('/api/alunos/:id/checkins', todos, async (req) =>
    s.checkins.doAluno(id.parse((req.params as any).id)));

  app.get('/api/alunos/:id/vendas', { preHandler: exigir('dono', 'recepcao') }, async (req) =>
    s.produtos.vendasDoAluno(id.parse((req.params as any).id)));

  app.get('/api/alunos/:id/pagamentos', { preHandler: exigir('dono', 'recepcao') }, async (req) =>
    s.financeiro.pagamentosDoAluno(id.parse((req.params as any).id)));

  app.get('/api/alunos/:id/fichas', todos, async (req) =>
    s.fichas.listar(id.parse((req.params as any).id)));

  app.post('/api/checkins', todos, async (req, reply) => {
    const d = z.object({ alunoId: z.number().int().positive(), atividade: z.string().min(1) }).parse(req.body);
    return reply.status(201).send(s.checkins.registrar({ ...d, usuarioId: req.usuario!.id }));
  });
}
