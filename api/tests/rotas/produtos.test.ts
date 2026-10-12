import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { aluno, sessao, usuario } from '../../src/db/schema.js';
import { hoje } from '../../src/dominio/datas.js';

let banco: ReturnType<typeof criarBancoDeTeste>;
let servidor: FastifyInstance;
let senhaHash: string;
let alunoId: number;
let donoId: number;
const senha = 'senha-do-dono-123';
const cookies: Record<string, string> = {};
type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';

const como = (papel: string, metodo: Metodo, caminho: string, corpo?: any) =>
  servidor.inject({ method: metodo, url: caminho, payload: corpo, headers: { cookie: cookies[papel] } });

function fotoJpeg(bytes: number) {
  const conteudo = Buffer.alloc(bytes);
  conteudo.set([0xff, 0xd8, 0xff]);
  conteudo.set([0xff, 0xd9], bytes - 2);
  return `data:image/jpeg;base64,${conteudo.toString('base64')}`;
}

const foto = fotoJpeg(20);
const dadosProduto = { nome: 'Camiseta', precoCentavos: 4500, estoque: 10, fotos: [foto] };

async function criarProduto(campos: Record<string, unknown> = {}) {
  const resposta = await como('dono', 'POST', '/api/produtos', { ...dadosProduto, ...campos });
  expect(resposta.statusCode).toBe(201);
  return resposta.json();
}

async function vender(produtoId: number, campos: Record<string, unknown> = {}) {
  const resposta = await como('recepcao', 'POST', '/api/vendas', {
    produtoId, quantidade: 1, situacao: 'paga', forma: 'pix', ...campos,
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json();
}

beforeAll(async () => { senhaHash = await hashSenha(senha); });
beforeEach(async () => {
  banco = criarBancoDeTeste();
  for (const papel of ['dono', 'recepcao', 'professor'] as const) {
    const pessoa = banco.db.insert(usuario).values({
      nome: papel, email: `${papel}@academia.test`, papel, senhaHash,
    }).returning().get();
    if (papel === 'dono') donoId = pessoa.id;
    const token = `sessao-produtos-${papel}`;
    banco.db.insert(sessao).values({
      usuarioId: pessoa.id, token, expiraEm: new Date(Date.now() + 3_600_000).toISOString(),
    }).run();
    cookies[papel] = `df_sessao=${token}`;
  }
  alunoId = banco.db.insert(aluno).values({ nome: 'Ana', telefone: '+5511999990000' }).returning().get().id;
  servidor = construirServidor({ db: banco.db as any });
  await servidor.ready();
});
afterEach(async () => { await servidor.close(); banco.fechar(); });

const rotas: [Metodo, string, any?][] = [
  ['GET', '/api/produtos'],
  ['POST', '/api/produtos', dadosProduto],
  ['PUT', '/api/produtos/1', { nome: 'Novo nome' }],
  ['DELETE', '/api/produtos/1'],
  ['GET', '/api/vendas'],
  ['POST', '/api/vendas', { produtoId: 1, quantidade: 1, situacao: 'paga', forma: 'pix' }],
  ['POST', '/api/vendas/1/receber', { forma: 'dinheiro' }],
  ['DELETE', '/api/vendas/1', { senha }],
];

describe('produtos e vendas: permissões', () => {
  it.each(rotas)('sem sessão: %s %s responde 401', async (metodo, caminho, corpo) => {
    expect((await servidor.inject({ method: metodo, url: caminho, payload: corpo })).statusCode).toBe(401);
  });

  it.each(rotas)('professor: %s %s responde 403', async (metodo, caminho, corpo) => {
    expect((await como('professor', metodo, caminho, corpo)).statusCode).toBe(403);
  });

  it('recepção não cria, edita nem exclui produto e não exclui venda', async () => {
    for (const [metodo, caminho, corpo] of rotas.filter(([metodo, caminho]) =>
      (caminho.startsWith('/api/produtos') && metodo !== 'GET') || metodo === 'DELETE')) {
      expect((await como('recepcao', metodo, caminho, corpo)).statusCode).toBe(403);
    }
  });
});

describe('produtos: cadastro e histórico', () => {
  it('dono cadastra, edita e exclui produto sem vendas', async () => {
    const produto = await criarProduto({ descricao: 'Algodão', categoria: 'Vestuário' });
    expect(produto).toMatchObject({ ...dadosProduto, descricao: 'Algodão', categoria: 'Vestuário', ativo: true });
    const edicao = await como('dono', 'PUT', `/api/produtos/${produto.id}`, {
      nome: 'Camiseta preta', descricao: null, categoria: null, precoCentavos: 5000, estoque: 4, fotos: [],
    });
    expect(edicao.statusCode).toBe(200);
    expect(edicao.json()).toMatchObject({
      nome: 'Camiseta preta', descricao: null, categoria: null, precoCentavos: 5000, estoque: 4, fotos: [],
    });
    expect((await como('dono', 'DELETE', `/api/produtos/${produto.id}`)).statusCode).toBe(200);
    expect((await como('dono', 'GET', '/api/produtos?todos=1')).json()).toEqual([]);
  });

  it('lista ativos por nome e permite só ao dono incluir inativos', async () => {
    const ultimo = await criarProduto({ nome: 'Whey' });
    await criarProduto({ nome: 'Agua' });
    await criarProduto({ nome: 'Barra' });
    await como('dono', 'PUT', `/api/produtos/${ultimo.id}`, { ativo: false });
    for (const papel of ['dono', 'recepcao']) {
      expect((await como(papel, 'GET', '/api/produtos')).json().map((produto: any) => produto.nome))
        .toEqual(['Agua', 'Barra']);
    }
    expect((await como('recepcao', 'GET', '/api/produtos?todos=1')).json().map((produto: any) => produto.nome))
      .toEqual(['Agua', 'Barra']);
    expect((await como('dono', 'GET', '/api/produtos?todos=1')).json().map((produto: any) => produto.nome))
      .toEqual(['Agua', 'Barra', 'Whey']);
  });

  it('excluir produto vendido desativa e preserva a venda', async () => {
    const produto = await criarProduto();
    const venda = await vender(produto.id);
    expect((await como('dono', 'DELETE', `/api/produtos/${produto.id}`)).statusCode).toBe(200);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()).toEqual([]);
    expect((await como('dono', 'GET', '/api/produtos?todos=1')).json()).toMatchObject([{ id: produto.id, ativo: false }]);
    expect((await como('recepcao', 'GET', '/api/vendas')).json()).toMatchObject([{ id: venda.id, produtoNome: 'Camiseta' }]);
    const resposta = await como('recepcao', 'POST', '/api/vendas', {
      produtoId: produto.id, quantidade: 1, situacao: 'paga', forma: 'pix',
    });
    expect(resposta.statusCode).toBe(400);
  });

  it.each([
    { nome: '   ' }, { precoCentavos: -1 }, { precoCentavos: 12.5 }, { precoCentavos: '4500' },
    { estoque: -1 }, { estoque: 0.5 }, { estoque: '1' }, { ativo: 'sim' },
  ])('recusa campo inválido no produto: %j', async (campo) => {
    const produto = await criarProduto();
    expect((await como('dono', 'POST', '/api/produtos', { ...dadosProduto, ...campo })).statusCode).toBe(400);
    expect((await como('dono', 'PUT', `/api/produtos/${produto.id}`, campo)).statusCode).toBe(400);
  });

  it('editar e excluir produto inexistente responde 404', async () => {
    expect((await como('dono', 'PUT', '/api/produtos/999', { nome: 'Ausente' })).statusCode).toBe(404);
    expect((await como('dono', 'DELETE', '/api/produtos/999')).statusCode).toBe(404);
  });
});

describe('produtos: fotos', () => {
  it('aceita três JPEGs de 400 KiB cada no cadastro e edição, mesmo acima de 1 MiB no corpo', async () => {
    const fotos = Array.from({ length: 3 }, () => fotoJpeg(400 * 1024));
    expect(Buffer.byteLength(JSON.stringify({ ...dadosProduto, fotos }))).toBeGreaterThan(1024 * 1024);
    const produto = await criarProduto({ fotos });
    expect(produto.fotos).toEqual(fotos);
    const resposta = await como('dono', 'PUT', `/api/produtos/${produto.id}`, { fotos });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().fotos).toEqual(fotos);
  });

  it('recusa foto com um byte acima de 400 KiB sem alterar o produto', async () => {
    const produto = await criarProduto();
    const fotos = [fotoJpeg(400 * 1024 + 1)];
    expect((await como('dono', 'POST', '/api/produtos', { ...dadosProduto, fotos })).statusCode).toBe(400);
    expect((await como('dono', 'PUT', `/api/produtos/${produto.id}`, { fotos })).statusCode).toBe(400);
    expect((await como('dono', 'GET', '/api/produtos')).json()).toMatchObject([{ id: produto.id, fotos: [foto] }]);
  });

  it.each([
    [foto, foto, foto, foto], ['data:image/png;base64,/9j/AA=='], ['https://exemplo.test/foto.jpg'],
    ['data:image/jpeg;base64,%%%'], ['data:image/jpeg;base64,'], [123], 'foto',
  ])('recusa fotos fora do contrato: %j', async (primeira, ...demais) => {
    const fotos = typeof primeira === 'string' && primeira === 'foto' ? primeira : [primeira, ...demais];
    expect((await como('dono', 'POST', '/api/produtos', { ...dadosProduto, fotos })).statusCode).toBe(400);
  });
});

describe('vendas: estoque e recebimento', () => {
  it('venda paga avulsa calcula pelo preço cadastrado e baixa o estoque', async () => {
    const produto = await criarProduto();
    const venda = await vender(produto.id, {
      quantidade: 2, valorUnitarioCentavos: 1, totalCentavos: 2, registradoPorUsuarioId: donoId,
    });
    expect(venda).toMatchObject({
      produtoId: produto.id, quantidade: 2, valorUnitarioCentavos: 4500, totalCentavos: 9000,
      alunoId: null, situacao: 'paga', forma: 'pix', dataVenda: hoje(), pagaEm: hoje(),
    });
    expect(venda.registradoPorUsuarioId).not.toBe(donoId);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()).toMatchObject([{ id: produto.id, estoque: 8 }]);
    expect((await como('recepcao', 'GET', '/api/vendas?situacao=paga')).json()).toMatchObject([
      { id: venda.id, produtoNome: 'Camiseta', alunoNome: null },
    ]);
    await como('dono', 'PUT', `/api/produtos/${produto.id}`, { precoCentavos: 6000 });
    expect((await como('recepcao', 'GET', '/api/vendas')).json()[0].valorUnitarioCentavos).toBe(4500);
  });

  it('estoque insuficiente devolve a mensagem exata sem criar venda nem baixar estoque', async () => {
    const produto = await criarProduto({ estoque: 2 });
    const resposta = await como('recepcao', 'POST', '/api/vendas', {
      produtoId: produto.id, quantidade: 3, situacao: 'paga', forma: 'pix',
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toBe('Só tem 2 em estoque.');
    expect((await como('recepcao', 'GET', '/api/vendas')).json()).toEqual([]);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(2);
  });

  it('fiado de aluno deixa forma nula, filtra a lista e recebe sem nova baixa de estoque', async () => {
    const produto = await criarProduto();
    const venda = await vender(produto.id, { quantidade: 2, alunoId, situacao: 'fiado', forma: 'dinheiro' });
    expect(venda).toMatchObject({ alunoId, situacao: 'fiado', forma: null, pagaEm: null });
    expect((await como('recepcao', 'GET', '/api/vendas?situacao=paga')).json()).toEqual([]);
    expect((await como('recepcao', 'GET', '/api/vendas?situacao=fiado')).json()).toMatchObject([
      { id: venda.id, alunoNome: 'Ana', produtoNome: 'Camiseta' },
    ]);
    const resposta = await como('recepcao', 'POST', `/api/vendas/${venda.id}/receber`, { forma: 'debito' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ id: venda.id, situacao: 'paga', forma: 'debito', pagaEm: hoje() });
    expect((await como('recepcao', 'GET', '/api/vendas?situacao=fiado')).json()).toEqual([]);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(8);
    expect((await como('recepcao', 'POST', `/api/vendas/${venda.id}/receber`, { forma: 'pix' })).statusCode).toBe(400);
    expect((await como('recepcao', 'GET', '/api/vendas')).json()[0].forma).toBe('debito');
  });

  it('aceita fiado avulso com nome e exige identificação para fiado', async () => {
    const produto = await criarProduto();
    const venda = await vender(produto.id, { situacao: 'fiado', clienteNome: 'Visitante' });
    expect(venda).toMatchObject({ alunoId: null, clienteNome: 'Visitante', situacao: 'fiado', forma: null });
    for (const clienteNome of [undefined, '', '   ']) {
      const resposta = await como('recepcao', 'POST', '/api/vendas', {
        produtoId: produto.id, quantidade: 1, situacao: 'fiado', clienteNome,
      });
      expect(resposta.statusCode).toBe(400);
    }
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(9);
  });

  it.each([
    { quantidade: 0 }, { quantidade: -1 }, { quantidade: 0.5 }, { quantidade: '1' },
    { situacao: 'cancelada' }, { forma: 'boleto' }, { forma: undefined }, { forma: null },
    { alunoId: -1 }, { produtoId: 0 },
  ])('recusa venda inválida: %j', async (campos) => {
    const produto = await criarProduto();
    const resposta = await como('recepcao', 'POST', '/api/vendas', {
      produtoId: produto.id, quantidade: 1, situacao: 'paga', forma: 'pix', ...campos,
    });
    expect(resposta.statusCode).toBe(400);
    expect((await como('recepcao', 'GET', '/api/vendas')).json()).toEqual([]);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(10);
  });

  it('vínculos inexistentes respondem 404 sem baixar estoque', async () => {
    const produto = await criarProduto();
    for (const campos of [{ produtoId: 999 }, { alunoId: 999 }]) {
      expect((await como('recepcao', 'POST', '/api/vendas', {
        produtoId: produto.id, quantidade: 1, situacao: 'paga', forma: 'pix', ...campos,
      })).statusCode).toBe(404);
    }
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(10);
  });

  it('filtrar por situação inválida e receber com forma inválida respondem 400', async () => {
    const produto = await criarProduto();
    const venda = await vender(produto.id, { situacao: 'fiado', alunoId });
    expect((await como('recepcao', 'GET', '/api/vendas?situacao=cancelada')).statusCode).toBe(400);
    for (const corpo of [{}, { forma: 'boleto' }, { forma: 1 }]) {
      expect((await como('recepcao', 'POST', `/api/vendas/${venda.id}/receber`, corpo)).statusCode).toBe(400);
    }
    expect((await como('recepcao', 'GET', '/api/vendas')).json()[0].situacao).toBe('fiado');
  });

  it('receber ou excluir venda inexistente responde 404', async () => {
    expect((await como('recepcao', 'POST', '/api/vendas/999/receber', { forma: 'pix' })).statusCode).toBe(404);
    expect((await como('dono', 'DELETE', '/api/vendas/999', { senha })).statusCode).toBe(404);
  });

  it('excluir venda exige senha do dono e devolve estoque uma única vez', async () => {
    const produto = await criarProduto();
    const venda = await vender(produto.id, { quantidade: 3 });
    for (const corpo of [{}, { senha: '' }, { senha: 123 }]) {
      expect((await como('dono', 'DELETE', `/api/vendas/${venda.id}`, corpo)).statusCode).toBe(400);
    }
    const errada = await como('dono', 'DELETE', `/api/vendas/${venda.id}`, { senha: 'senha-errada' });
    expect(errada.statusCode).toBe(400);
    expect(errada.json().erro).toBe('Senha incorreta.');
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(7);
    expect((await como('recepcao', 'GET', '/api/vendas')).json()).toHaveLength(1);
    expect((await como('dono', 'DELETE', `/api/vendas/${venda.id}`, { senha })).statusCode).toBe(200);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(10);
    expect((await como('recepcao', 'GET', '/api/vendas')).json()).toEqual([]);
    expect((await como('dono', 'DELETE', `/api/vendas/${venda.id}`, { senha })).statusCode).toBe(404);
    expect((await como('recepcao', 'GET', '/api/produtos')).json()[0].estoque).toBe(10);
  });

  it('vendas pagas e recebimento de fiado ficam fora da receita de mensalidades', async () => {
    const produto = await criarProduto();
    const antes = (await como('dono', 'GET', '/api/dashboard')).json().receitaMesCentavos;
    await vender(produto.id);
    const fiado = await vender(produto.id, { alunoId, situacao: 'fiado' });
    expect((await como('recepcao', 'POST', `/api/vendas/${fiado.id}/receber`, { forma: 'pix' })).statusCode).toBe(200);
    expect((await como('dono', 'GET', '/api/dashboard')).json().receitaMesCentavos).toBe(antes);
  });

  it('lista no máximo as 100 vendas mais recentes, inclusive desempate do mesmo dia', async () => {
    const produto = await criarProduto({ estoque: 101 });
    const identificadores: number[] = [];
    for (let quantidade = 0; quantidade < 101; quantidade++) {
      identificadores.push((await vender(produto.id)).id);
    }
    const vendas = (await como('recepcao', 'GET', '/api/vendas')).json();
    expect(vendas).toHaveLength(100);
    expect(vendas.map((venda: any) => venda.id)).toEqual(identificadores.slice(1).reverse());
  });
});
