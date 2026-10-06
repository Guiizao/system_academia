import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigir } from '../plugins/autenticacao.js';
import type { Servicos } from '../servidor.js';

const id = z.coerce.number().int().positive();
const forma = z.enum(['pix', 'dinheiro', 'credito', 'debito', 'boleto']);

export function rotasFinanceiro(app: FastifyInstance, s: Servicos) {
  const caixa = { preHandler: exigir('dono', 'recepcao') };
  const dono = { preHandler: exigir('dono') };

  // ?todos=1 inclui os desativados -- so o dono precisa deles, para reativar
  app.get('/api/planos', { preHandler: exigir() }, async (req) => {
    const todos = (req.query as any)?.todos === '1' && req.usuario?.papel === 'dono';
    return s.planos.listar(todos);
  });

  app.put('/api/planos/:id', dono, async (req) => {
    const d = z.object({
      nome: z.string().max(80).optional(),
      precoCentavos: z.number().optional(),
      duracaoMeses: z.number().optional(),
      /** preenchido = diaria; null volta a ser mensalidade */
      duracaoDias: z.number().nullable().optional(),
      beneficios: z.array(z.string()).optional(),
      destaque: z.boolean().optional(),
      /** false tira da lista de venda; true reativa */
      ativo: z.boolean().optional(),
    }).parse(req.body);
    return s.planos.atualizar(id.parse((req.params as any).id), d);
  });

  app.post('/api/planos', dono, async (req, reply) => {
    const d = z.object({
      nome: z.string().max(80),
      precoCentavos: z.number(),
      duracaoMeses: z.number(),
      duracaoDias: z.number().nullish(),
      beneficios: z.array(z.string()).optional(),
      destaque: z.boolean().optional(),
    }).parse(req.body);
    return reply.status(201).send(s.planos.criar(d));
  });

  /** ordem em que os planos aparecem na tela */
  app.post('/api/planos/ordem', dono, async (req) => {
    const d = z.object({ ids: z.array(id).min(1).max(60) }).parse(req.body);
    return s.planos.reordenar(d.ids);
  });

  /** apaga de vez; o servico recusa se o plano ja tem historico */
  app.delete('/api/planos/:id', dono, async (req) =>
    s.planos.excluir(id.parse((req.params as any).id)));

  // numeros e serie historica para os graficos e o relatorio do mes
  app.get('/api/relatorios/financeiro', dono, async (req) => {
    const mes = z.string().regex(/^\d{4}-\d{2}$/).optional().parse((req.query as any).mes);
    return { ...s.relatorios.doMes(mes), texto: s.relatorios.textoDoMes(mes) };
  });

  app.get('/api/cobrancas', caixa, async () => s.financeiro.cobrancasAbertas());

  app.get('/api/cobrancas/:id/pix', caixa, async (req) =>
    s.financeiro.pixDaCobranca(id.parse((req.params as any).id)));

  app.get('/api/pix', caixa, async (req) =>
    s.financeiro.pixAvulso(z.coerce.number().int().positive().parse((req.query as any).valor)));

  app.get('/api/pagamentos', caixa, async () => s.financeiro.pagamentosRecentes(30));

  app.post('/api/pagamentos', caixa, async (req, reply) => {
    const d = z.object({
      alunoId: z.number().int().positive(),
      valorCentavos: z.number().int().positive(),
      forma,
      cobrancaId: z.number().int().positive().optional(),
      planoId: z.number().int().positive().optional(),
      dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      observacao: z.string().max(200).optional(),
      /** diária marcada para outro dia */
      dataInicioEscolhida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
      /** vencimento na mão, quando a recepção não quer o cálculo automático */
      dataFimManual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    }).parse(req.body);
    return reply.status(201).send(s.financeiro.registrarPagamento({ ...d, usuarioId: req.usuario!.id }));
  });

  app.get('/api/financeiro/distribuicao', dono, async () => s.financeiro.distribuicaoPorPlano());
}
