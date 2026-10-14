import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoProdutos } from '../../src/servicos/produtos.js';
import { criarServicoFinanceiro } from '../../src/servicos/financeiro.js';
import { hoje } from '../../src/dominio/datas.js';
import { produto, venda, aluno, usuario } from '../../src/db/schema.js';

const FOTO = 'data:image/jpeg;base64,/9j/2Q==';
let banco: ReturnType<typeof criarBancoDeTeste>;
let servico: ReturnType<typeof criarServicoProdutos>;
let donoId: number, alunoId: number;

beforeEach(() => {
  banco = criarBancoDeTeste();
  servico = criarServicoProdutos(banco.db);
  donoId = banco.db.insert(usuario).values({ nome: 'Dono de teste', email: 'dono@teste.local', papel: 'dono' }).returning().get().id;
  alunoId = banco.db.insert(aluno).values({ nome: 'Aluno de teste', telefone: '+5511999990002' }).returning().get().id;
});
afterEach(() => banco.fechar());

const cadastrar = (campos: Partial<Parameters<typeof servico.criar>[0]> = {}) => servico.criar({
  nome: 'Garrafa', precoCentavos: 1500, estoque: 5, ...campos,
});
const vender = (produtoId: number, campos: Partial<Parameters<typeof servico.registrarVenda>[0]> = {}) =>
  servico.registrarVenda({
    produtoId, quantidade: 1, situacao: 'paga', forma: 'pix', registradoPorUsuarioId: donoId, ...campos,
  });
const estoqueDe = (produtoId: number) => banco.db.select().from(produto).where(eq(produto.id, produtoId)).get()!.estoque;

it('mantém todas as dívidas visíveis mesmo depois de cem vendas fiadas', () => {
  const mercadoria = cadastrar({ estoque: 101 });
  const ids = Array.from({ length: 101 }, () => vender(mercadoria.id, { situacao: 'fiado', alunoId }).id);
  expect(servico.listarVendas('fiado').map((registro) => registro.id)).toEqual(ids.reverse());
});

describe('cadastro de produtos', () => {
  it('cadastra os campos do contrato e edita somente os campos informados', () => {
    const criado = cadastrar({ descricao: 'Garrafa de 500 ml', categoria: 'Acessórios', fotos: [FOTO] });
    expect(criado).toMatchObject({
      nome: 'Garrafa', descricao: 'Garrafa de 500 ml', categoria: 'Acessórios',
      precoCentavos: 1500, estoque: 5, fotos: [FOTO], ativo: true,
    });
    expect(servico.atualizar(criado.id, { nome: 'Garrafa nova', precoCentavos: 1800, estoque: 8 })).toMatchObject({
      id: criado.id, nome: 'Garrafa nova', precoCentavos: 1800, estoque: 8,
      descricao: 'Garrafa de 500 ml', categoria: 'Acessórios', fotos: [FOTO],
    });
  });

  it('lista ativos por nome e inclui inativos somente quando solicitado', () => {
    const garrafa = cadastrar();
    const agua = cadastrar({ nome: 'Agua' });
    const barra = cadastrar({ nome: 'Barra', ativo: false });
    expect(servico.listar().map((registro) => registro.id)).toEqual([agua.id, garrafa.id]);
    expect(servico.listar(true).map((registro) => registro.id)).toEqual([agua.id, barra.id, garrafa.id]);
    servico.atualizar(barra.id, { ativo: true });
    expect(servico.listar()).toHaveLength(3);
  });

  it.each([
    { precoCentavos: 0 }, { precoCentavos: -1 }, { precoCentavos: 12.5 },
    { estoque: -1 }, { estoque: 1.5 }, { nome: '   ' },
  ])('recusa cadastro inválido: %j', (campos) => {
    expect(() => cadastrar(campos)).toThrow();
    expect(servico.listar(true)).toHaveLength(0);
  });

  it('recusa alterações inválidas sem modificar o cadastro', () => {
    const criado = cadastrar();
    expect(() => servico.atualizar(criado.id, { estoque: -1 })).toThrow();
    expect(() => servico.atualizar(criado.id, { precoCentavos: 1.5 })).toThrow();
    expect(servico.listar()).toMatchObject([{ id: criado.id, estoque: 5, precoCentavos: 1500 }]);
  });

  it('aceita estoque zero e até três fotos JPEG', () => {
    const criado = cadastrar({ estoque: 0, fotos: [FOTO, FOTO, FOTO] });
    expect(criado.estoque).toBe(0);
    expect(criado.fotos).toEqual([FOTO, FOTO, FOTO]);
    expect(() => cadastrar({ fotos: [FOTO, FOTO, FOTO, FOTO] })).toThrow();
  });

  it.each(['data:image/png;base64,/9j/2Q==', 'data:image/jpeg;base64,%%%!', 'https://teste.local/foto.jpg'])('recusa foto fora do formato JPEG em base64: %s', (foto) => {
    expect(() => cadastrar({ fotos: [foto] })).toThrow();
    expect(servico.listar(true)).toHaveLength(0);
  });

  it('limita cada foto pelo tamanho decodificado e preserva o produto quando uma nova foto excede 400 KiB', () => {
    const noLimite = `data:image/jpeg;base64,${Buffer.alloc(400 * 1024).toString('base64')}`;
    const acima = `data:image/jpeg;base64,${Buffer.alloc(400 * 1024 + 1).toString('base64')}`;
    const criado = cadastrar({ fotos: [noLimite] });
    expect(criado.fotos).toEqual([noLimite]);
    expect(() => cadastrar({ fotos: [acima] })).toThrow();
    expect(() => servico.atualizar(criado.id, { fotos: [acima] })).toThrow();
    expect(servico.listar(true)).toHaveLength(1);
    expect(servico.listar()[0].fotos).toEqual([noLimite]);
  });

  it('apaga produto sem vendas', () => {
    const criado = cadastrar();
    expect(servico.excluir(criado.id)).toEqual({ ok: true });
    expect(servico.listar(true)).toHaveLength(0);
  });

  it('desativa produto com vendas e preserva o histórico', () => {
    const criado = cadastrar();
    const registrada = vender(criado.id);
    expect(servico.excluir(criado.id)).toEqual({ ok: true });
    expect(servico.listar()).toHaveLength(0);
    expect(servico.listar(true)).toMatchObject([{ id: criado.id, ativo: false, estoque: 4 }]);
    expect(servico.listarVendas()).toMatchObject([{ id: registrada.id, produtoNome: 'Garrafa' }]);
    expect(() => vender(criado.id)).toThrow();
    expect(estoqueDe(criado.id)).toBe(4);
  });

  it('retorna erro 404 ao alterar ou excluir produto inexistente', () => {
    expect(() => servico.atualizar(9999, { nome: 'Inexistente' })).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => servico.excluir(9999)).toThrow(expect.objectContaining({ status: 404 }));
  });
});

describe('vendas de produtos', () => {
  it('calcula total no servidor, congela o preço e baixa o estoque', () => {
    const criado = cadastrar();
    const registrada = vender(criado.id, { quantidade: 2, alunoId, observacao: 'Retirada na recepção' });
    expect(registrada).toMatchObject({
      produtoId: criado.id, alunoId, quantidade: 2, valorUnitarioCentavos: 1500, totalCentavos: 3000,
      situacao: 'paga', forma: 'pix', dataVenda: hoje(), pagaEm: hoje(),
      registradoPorUsuarioId: donoId, observacao: 'Retirada na recepção',
    });
    expect(estoqueDe(criado.id)).toBe(3);
    servico.atualizar(criado.id, { precoCentavos: 2200 });
    expect(servico.listarVendas()[0]).toMatchObject({ valorUnitarioCentavos: 1500, totalCentavos: 3000 });
    expect(vender(criado.id).totalCentavos).toBe(2200);
  });

  it('recusa estoque insuficiente com a mensagem contratada e sem gravar venda', () => {
    const criado = cadastrar({ estoque: 2 });
    expect(() => vender(criado.id, { quantidade: 3 })).toThrow('Só tem 2 em estoque.');
    expect(estoqueDe(criado.id)).toBe(2);
    expect(servico.listarVendas()).toHaveLength(0);
  });

  it('permite vender todo o estoque e recusa a próxima venda', () => {
    const criado = cadastrar({ estoque: 1 });
    vender(criado.id);
    expect(estoqueDe(criado.id)).toBe(0);
    expect(() => vender(criado.id)).toThrow('Só tem 0 em estoque.');
    expect(servico.listarVendas()).toHaveLength(1);
  });

  it.each([0, -1, 1.5])('recusa quantidade inválida %s sem baixar estoque', (quantidade) => {
    const criado = cadastrar();
    expect(() => vender(criado.id, { quantidade })).toThrow();
    expect(estoqueDe(criado.id)).toBe(5);
    expect(servico.listarVendas()).toHaveLength(0);
  });

  it('exige forma de pagamento na venda paga', () => {
    const criado = cadastrar();
    expect(() => vender(criado.id, { forma: undefined })).toThrow();
    expect(estoqueDe(criado.id)).toBe(5);
    expect(servico.listarVendas()).toHaveLength(0);
  });

  it('exige aluno ou cliente identificado no fiado e grava forma e pagaEm nulos', () => {
    const criado = cadastrar();
    expect(() => vender(criado.id, { situacao: 'fiado' })).toThrow();
    expect(() => vender(criado.id, { situacao: 'fiado', clienteNome: '   ' })).toThrow();
    expect(estoqueDe(criado.id)).toBe(5);
    expect(vender(criado.id, { situacao: 'fiado', alunoId })).toMatchObject({
      alunoId, situacao: 'fiado', forma: null, pagaEm: null,
    });
    expect(vender(criado.id, { situacao: 'fiado', clienteNome: 'Cliente avulso' })).toMatchObject({
      alunoId: null, clienteNome: 'Cliente avulso', situacao: 'fiado', forma: null, pagaEm: null,
    });
  });

  it('recebe fiado sem baixar estoque novamente e recusa recebimento duplicado', () => {
    const criado = cadastrar();
    const registrada = vender(criado.id, { situacao: 'fiado', alunoId, quantidade: 2 });
    expect(servico.receberVenda(registrada.id, 'dinheiro')).toMatchObject({
      id: registrada.id, situacao: 'paga', forma: 'dinheiro', pagaEm: hoje(), totalCentavos: 3000,
    });
    expect(estoqueDe(criado.id)).toBe(3);
    expect(() => servico.receberVenda(registrada.id, 'credito')).toThrow();
    expect(servico.listarVendas()[0].forma).toBe('dinheiro');
    expect(estoqueDe(criado.id)).toBe(3);
  });

  it.each(['paga', 'fiado'] as const)('excluir venda %s devolve o estoque uma única vez', (situacao) => {
    const criado = cadastrar();
    const registrada = vender(criado.id, { situacao, alunoId, quantidade: 2 });
    expect(estoqueDe(criado.id)).toBe(3);
    expect(servico.excluirVenda(registrada.id)).toEqual({ ok: true });
    expect(estoqueDe(criado.id)).toBe(5);
    expect(servico.listarVendas()).toHaveLength(0);
    expect(() => servico.excluirVenda(registrada.id)).toThrow(expect.objectContaining({ status: 404 }));
    expect(estoqueDe(criado.id)).toBe(5);
  });

  it('devolve estoque ao excluir venda de produto desativado, sem reativá-lo', () => {
    const criado = cadastrar();
    const registrada = vender(criado.id);
    servico.excluir(criado.id);
    servico.excluirVenda(registrada.id);
    expect(servico.listar()).toHaveLength(0);
    expect(servico.listar(true)).toMatchObject([{ id: criado.id, ativo: false, estoque: 5 }]);
  });

  it('lista vendas com nomes, situação e desempate estável da mais recente para a antiga', () => {
    const criado = cadastrar();
    const primeira = vender(criado.id, { alunoId, situacao: 'fiado' });
    const segunda = vender(criado.id, { clienteNome: 'Cliente avulso' });
    expect(servico.listarVendas()).toMatchObject([
      { id: segunda.id, produtoNome: 'Garrafa', alunoNome: null, clienteNome: 'Cliente avulso' },
      { id: primeira.id, produtoNome: 'Garrafa', alunoNome: 'Aluno de teste' },
    ]);
    expect(servico.listarVendas('fiado').map((registro) => registro.id)).toEqual([primeira.id]);
    expect(servico.listarVendas('paga').map((registro) => registro.id)).toEqual([segunda.id]);
    servico.receberVenda(primeira.id, 'debito');
    expect(servico.listarVendas('fiado')).toHaveLength(0);
  });

  it('limita a listagem às 100 vendas mais recentes', () => {
    const criado = cadastrar({ estoque: 105 });
    const ids = Array.from({ length: 105 }, () => vender(criado.id).id);
    expect(servico.listarVendas().map((registro) => registro.id)).toEqual(ids.slice(5).reverse());
  });

  it('recusa aluno ou produto inexistente antes de alterar o estoque', () => {
    const criado = cadastrar();
    expect(() => vender(criado.id, { alunoId: 9999 })).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => vender(9999)).toThrow(expect.objectContaining({ status: 404 }));
    expect(estoqueDe(criado.id)).toBe(5);
    expect(servico.listarVendas()).toHaveLength(0);
  });

  it('retorna 404 ao receber ou excluir venda inexistente', () => {
    expect(() => servico.receberVenda(9999, 'pix')).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => servico.excluirVenda(9999)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('não inclui vendas nem recebimentos de fiado na receita de mensalidades', () => {
    const financeiro = criarServicoFinanceiro(banco.db);
    financeiro.registrarPagamento({ alunoId, valorCentavos: 13900, forma: 'pix', dataPagamento: hoje() });
    const criado = cadastrar();
    vender(criado.id, { quantidade: 2 });
    const fiado = vender(criado.id, { alunoId, situacao: 'fiado' });
    servico.receberVenda(fiado.id, 'pix');
    expect(financeiro.receitaDoMes(hoje().slice(0, 7))).toBe(13900);
    expect(financeiro.recebidoEm(hoje())).toBe(13900);
  });

  it('restaura o estoque quando a inserção da venda falha', () => {
    const criado = cadastrar();
    banco.sqlite.exec(`
      CREATE TRIGGER falha_venda BEFORE INSERT ON venda
      BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;
    `);
    expect(() => vender(criado.id, { quantidade: 2 })).toThrow('falha simulada');
    expect(estoqueDe(criado.id)).toBe(5);
    expect(servico.listarVendas()).toHaveLength(0);
  });

  it('restaura venda e estoque se a devolução ao cancelar falha', () => {
    const criado = cadastrar();
    const registrada = vender(criado.id, { quantidade: 2 });
    banco.sqlite.exec(`
      CREATE TRIGGER falha_devolucao BEFORE UPDATE ON produto
      BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;
    `);
    expect(() => servico.excluirVenda(registrada.id)).toThrow('falha simulada');
    expect(estoqueDe(criado.id)).toBe(3);
    expect(banco.db.select().from(venda).where(eq(venda.id, registrada.id)).get()).toMatchObject({ totalCentavos: 3000 });
  });
});
