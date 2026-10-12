import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigir } from '../plugins/autenticacao.js';
import type { Servicos } from '../servidor.js';

const identificador = z.coerce.number().int().positive();

export function rotasProdutos(aplicacao: FastifyInstance, servicos: Servicos) {
  const caixa = { preHandler: exigir('dono', 'recepcao') };
  const dono = { preHandler: exigir('dono') };
  // Três JPEGs de 400 KB crescem ao virar base64; o limite fica apenas nestas rotas.
  const cadastro = { ...dono, bodyLimit: 3 * 4 * Math.ceil(400 * 1024 / 3) + 16 * 1024 };

  aplicacao.get('/api/produtos', caixa, async (requisicao) => {
    const { todos } = z.object({ todos: z.enum(['0', '1']).optional() }).parse(requisicao.query);
    return servicos.produtos.listar(todos === '1' && requisicao.usuario!.papel === 'dono');
  });

  aplicacao.post('/api/produtos', cadastro, async (requisicao, resposta) => {
    return resposta.status(201).send(servicos.produtos.criar(requisicao.body as Parameters<typeof servicos.produtos.criar>[0]));
  });

  aplicacao.put('/api/produtos/:id', cadastro, async (requisicao) => {
    const { id } = z.object({ id: identificador }).parse(requisicao.params);
    return servicos.produtos.atualizar(id, requisicao.body as Parameters<typeof servicos.produtos.atualizar>[1]);
  });

  aplicacao.delete('/api/produtos/:id', dono, async (requisicao) => {
    const { id } = z.object({ id: identificador }).parse(requisicao.params);
    return servicos.produtos.excluir(id);
  });

  aplicacao.get('/api/vendas', caixa, async (requisicao) => {
    const { situacao } = z.object({ situacao: z.enum(['paga', 'fiado']).optional() }).parse(requisicao.query);
    return servicos.produtos.listarVendas(situacao);
  });

  aplicacao.post('/api/vendas', caixa, async (requisicao, resposta) => {
    const dados = z.record(z.string(), z.unknown()).parse(requisicao.body);
    return resposta.status(201).send(servicos.produtos.registrarVenda({
      ...dados, registradoPorUsuarioId: requisicao.usuario!.id,
    } as Parameters<typeof servicos.produtos.registrarVenda>[0]));
  });

  aplicacao.post('/api/vendas/:id/receber', caixa, async (requisicao) => {
    const { id } = z.object({ id: identificador }).parse(requisicao.params);
    const { forma } = z.object({ forma: z.enum(['pix', 'dinheiro', 'credito', 'debito']) }).parse(requisicao.body);
    return servicos.produtos.receberVenda(id, forma);
  });

  aplicacao.delete('/api/vendas/:id', dono, async (requisicao) => {
    const { id } = z.object({ id: identificador }).parse(requisicao.params);
    const { senha } = z.object({ senha: z.string().min(1).max(1024) }).parse(requisicao.body);
    await servicos.auth.confirmarSenha(requisicao.usuario!.id, senha);
    return servicos.produtos.excluirVenda(id);
  });
}
