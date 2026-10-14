import { eq, desc, getTableColumns, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { produto, venda, aluno, usuario } from '../db/schema.js';
import { hoje } from '../dominio/datas.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Banco = BetterSQLite3Database<any>;
const TAMANHO_MAXIMO_FOTO = 400 * 1024;
const PREFIXO_FOTO = 'data:image/jpeg;base64,';
const foto = z.string().max(PREFIXO_FOTO.length + 4 * Math.ceil(TAMANHO_MAXIMO_FOTO / 3))
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/, 'Use uma foto JPEG em base64.')
  .refine((valor) => {
    const conteudo = valor.slice(PREFIXO_FOTO.length);
    const imagem = Buffer.from(conteudo, 'base64');
    return imagem.length > 0 && imagem.length <= TAMANHO_MAXIMO_FOTO && imagem.toString('base64') === conteudo;
  }, 'Cada foto deve ter até 400 KB.');

const dadosProduto = z.object({
  nome: z.string().trim().min(1).max(120),
  descricao: z.string().max(2000).nullish(),
  categoria: z.string().trim().max(80).nullish(),
  precoCentavos: z.number().int().positive(),
  estoque: z.number().int().nonnegative(),
  fotos: z.array(foto).max(3).optional(),
  ativo: z.boolean().optional(),
});

const formaVenda = z.enum(['pix', 'dinheiro', 'credito', 'debito']);
const situacaoVenda = z.enum(['paga', 'fiado']);
const dadosVenda = z.object({
  produtoId: z.number().int().positive(),
  quantidade: z.number().int().positive(),
  alunoId: z.number().int().positive().nullish(),
  clienteNome: z.string().trim().max(120).nullish(),
  situacao: situacaoVenda,
  forma: formaVenda.nullish(),
  registradoPorUsuarioId: z.number().int().positive(),
  observacao: z.string().max(500).nullish(),
});

type NovoProduto = z.input<typeof dadosProduto>;
type NovaVenda = z.input<typeof dadosVenda>;

export function criarServicoProdutos(banco: Banco) {
  function buscarProduto(id: number, consulta: Banco = banco) {
    const registro = consulta.select().from(produto).where(eq(produto.id, id)).get();
    if (!registro) throw new ErroNaoEncontrado('Produto não encontrado');
    return registro;
  }

  function buscarVenda(id: number, consulta: Banco = banco) {
    const registro = consulta.select().from(venda).where(eq(venda.id, id)).get();
    if (!registro) throw new ErroNaoEncontrado('Venda não encontrada');
    return registro;
  }

  function listar(todos = false) {
    return banco.select().from(produto).where(todos ? undefined : eq(produto.ativo, true))
      .orderBy(produto.nome, produto.id).all();
  }

  function criar(dados: NovoProduto) {
    return banco.insert(produto).values(dadosProduto.parse(dados)).returning().get();
  }

  function atualizar(id: number, dados: Partial<NovoProduto>) {
    const atual = buscarProduto(id);
    const campos = dadosProduto.partial().parse(dados);
    if (!Object.keys(campos).length) return atual;
    return banco.update(produto).set({ ...campos, atualizadoEm: new Date().toISOString() })
      .where(eq(produto.id, id)).returning().get()!;
  }

  function excluir(id: number) {
    return banco.transaction((transacao) => {
      buscarProduto(id, transacao as unknown as Banco);
      const vendida = transacao.select({ id: venda.id }).from(venda).where(eq(venda.produtoId, id)).get();
      if (vendida) transacao.update(produto).set({ ativo: false, atualizadoEm: new Date().toISOString() })
        .where(eq(produto.id, id)).run();
      else transacao.delete(produto).where(eq(produto.id, id)).run();
      return { ok: true };
    });
  }

  function listarVendas(situacao?: 'paga' | 'fiado') {
    const filtro = situacaoVenda.optional().parse(situacao);
    const consulta = banco.select({
      ...getTableColumns(venda), produtoNome: produto.nome, alunoNome: aluno.nome,
    }).from(venda)
      .innerJoin(produto, eq(produto.id, venda.produtoId))
      .leftJoin(aluno, eq(aluno.id, venda.alunoId))
      .where(filtro ? eq(venda.situacao, filtro) : undefined)
      .orderBy(desc(venda.dataVenda), desc(venda.id));
    return (filtro === 'fiado' ? consulta : consulta.limit(100)).all();
  }

  function registrarVenda(dados: NovaVenda) {
    const campos = dadosVenda.parse(dados);
    if (campos.situacao === 'fiado' && !campos.alunoId && !campos.clienteNome) {
      throw new ErroNegocio('Informe o aluno ou o nome do cliente para vender fiado.');
    }
    if (campos.situacao === 'paga' && !campos.forma) throw new ErroNegocio('Informe a forma de pagamento.');

    return banco.transaction((transacao) => {
      const registro = buscarProduto(campos.produtoId, transacao as unknown as Banco);
      if (!registro.ativo) throw new ErroNegocio('Produto desativado.');
      if (registro.estoque < campos.quantidade) throw new ErroNegocio(`Só tem ${registro.estoque} em estoque.`);
      if (campos.alunoId && !transacao.select({ id: aluno.id }).from(aluno).where(eq(aluno.id, campos.alunoId)).get()) {
        throw new ErroNaoEncontrado('Aluno não encontrado');
      }
      if (!transacao.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, campos.registradoPorUsuarioId)).get()) {
        throw new ErroNaoEncontrado('Usuário não encontrado');
      }
      const totalCentavos = registro.precoCentavos * campos.quantidade;
      if (!Number.isSafeInteger(totalCentavos)) throw new ErroNegocio('Total da venda acima do limite.');
      const dataVenda = hoje();
      transacao.update(produto).set({
        estoque: sql`${produto.estoque} - ${campos.quantidade}`, atualizadoEm: new Date().toISOString(),
      }).where(eq(produto.id, registro.id)).run();
      return transacao.insert(venda).values({
        ...campos, clienteNome: campos.clienteNome || null,
        valorUnitarioCentavos: registro.precoCentavos, totalCentavos, dataVenda,
        forma: campos.situacao === 'paga' ? campos.forma : null,
        pagaEm: campos.situacao === 'paga' ? dataVenda : null,
      }).returning().get();
    });
  }

  function receberVenda(id: number, forma: z.input<typeof formaVenda>) {
    const formaValidada = formaVenda.parse(forma);
    return banco.transaction((transacao) => {
      const registro = buscarVenda(id, transacao as unknown as Banco);
      if (registro.situacao !== 'fiado') throw new ErroNegocio('Venda já paga.');
      return transacao.update(venda).set({
        situacao: 'paga', forma: formaValidada, pagaEm: hoje(), atualizadoEm: new Date().toISOString(),
      }).where(eq(venda.id, id)).returning().get()!;
    });
  }

  function excluirVenda(id: number) {
    return banco.transaction((transacao) => {
      const registro = buscarVenda(id, transacao as unknown as Banco);
      const mercadoria = buscarProduto(registro.produtoId, transacao as unknown as Banco);
      if (!Number.isSafeInteger(mercadoria.estoque + registro.quantidade)) {
        throw new ErroNegocio('Estoque acima do limite.');
      }
      transacao.delete(venda).where(eq(venda.id, id)).run();
      transacao.update(produto).set({
        estoque: sql`${produto.estoque} + ${registro.quantidade}`, atualizadoEm: new Date().toISOString(),
      }).where(eq(produto.id, registro.produtoId)).run();
      return { ok: true };
    });
  }

  return { listar, criar, atualizar, excluir, listarVendas, registrarVenda, receberVenda, excluirVenda };
}
