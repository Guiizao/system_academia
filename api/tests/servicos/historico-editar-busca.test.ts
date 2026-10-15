import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor, criarServicos } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { adicionarMeses, hoje } from '../../src/dominio/datas.js';
import { aluno, plano, matricula, cobranca, pagamento, usuario, sessao } from '../../src/db/schema.js';

const SENHA = 'senha-do-dono-123';
const RECUSA = 'Esse pagamento tem renovação depois dele: só dá para mudar valor, forma e observação.';
let banco: ReturnType<typeof criarBancoDeTeste>;
let servicos: ReturnType<typeof criarServicos>;
let servidor: ReturnType<typeof construirServidor> | undefined;
let alunoId: number, planoId: number, senhaHash: string;

beforeAll(async () => { senhaHash = await hashSenha(SENHA); });
beforeEach(() => {
  banco = criarBancoDeTeste();
  servicos = criarServicos(banco.db);
  alunoId = banco.db.insert(aluno).values({ nome: 'José da Conceição', telefone: '+5511999990001' }).returning().get().id;
  planoId = banco.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 13900, duracaoMeses: 1 }).returning().get().id;
});
afterEach(async () => { await servidor?.close(); servidor = undefined; banco.fechar(); });

function pagar(campos: Partial<Parameters<typeof servicos.financeiro.registrarPagamento>[0]> = {}) {
  return servicos.financeiro.registrarPagamento({
    alunoId, planoId, valorCentavos: 13900, forma: 'pix', dataPagamento: '2026-10-15', ...campos,
  });
}
const atual = () => servicos.matriculas.matriculaAtualSync(alunoId);
const detalhes = () => servicos.financeiro.pagamentosDoAluno(alunoId);
const cobrar = (matriculaId: number, competencia: string, status: 'aberta' | 'cancelada' = 'aberta') =>
  banco.db.insert(cobranca).values({ alunoId, matriculaId, competencia, vencimento: `${competencia}-15`, valorCentavos: 13900, status })
    .returning().get();
const estado = () => ({
  pagamentos: banco.db.select().from(pagamento).all(),
  matriculas: banco.db.select().from(matricula).all(),
  cobrancas: banco.db.select().from(cobranca).all(),
});

describe('detalhe de pagamento e legado', () => {
  it('preserva todos os campos e identifica somente a matrícula ativa atual', () => {
    const primeiro = pagar();
    const segundo = pagar();
    const avulso = pagar({ planoId: undefined });
    expect(detalhes()).toEqual([
      { ...avulso.pagamento, alunoNome: 'José da Conceição', planoId: null, planoNome: null, alteraVencimento: false },
      { ...segundo.pagamento, alunoNome: 'José da Conceição', planoId, planoNome: 'Mensal', alteraVencimento: true },
      { ...primeiro.pagamento, alunoNome: 'José da Conceição', planoId, planoNome: 'Mensal', alteraVencimento: false },
    ]);
    banco.db.update(matricula).set({ status: 'cancelada' }).where(eq(matricula.id, segundo.matricula!.id)).run();
    expect(detalhes().every((item) => !item.alteraVencimento)).toBe(true);
  });

  it.each([0, 60_000])('reconhece e edita o legado no limite de %i ms', (intervalo) => {
    const registro = pagar();
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: '2026-10-15T12:00:00.000Z' }).run();
    banco.db.update(matricula).set({ criadoEm: new Date(Date.parse('2026-10-15T12:00:00.000Z') + intervalo).toISOString() }).run();
    expect(detalhes()[0]).toMatchObject({ matriculaId: registro.matricula!.id, planoId, planoNome: 'Mensal', alteraVencimento: true });
    const resposta = servicos.financeiro.editarPagamento(registro.pagamento.id, { dataPagamento: '2026-10-20' });
    expect(resposta).toMatchObject({ dataFimNova: '2026-11-20', pagamento: { id: registro.pagamento.id, alteraVencimento: true } });
    expect(resposta.pagamento.matriculaId).toBe(atual()!.id);
  });

  it.each([-1, 60_001])('não associa matrícula fora da janela: %i ms', (intervalo) => {
    pagar();
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: '2026-10-15T12:00:00.000Z' }).run();
    banco.db.update(matricula).set({ criadoEm: new Date(Date.parse('2026-10-15T12:00:00.000Z') + intervalo).toISOString() }).run();
    expect(detalhes()[0]).toMatchObject({ matriculaId: null, planoId: null, planoNome: null, alteraVencimento: false });
  });

  it('não libera edição de período do legado com pagamento posterior no mesmo instante', () => {
    const primeiro = pagar();
    const segundo = pagar();
    banco.db.update(pagamento).set({ matriculaId: null, criadoEm: '2026-10-15T12:00:00.000Z' }).run();
    banco.db.update(matricula).set({ criadoEm: '2026-10-15T12:00:00.000Z' }).run();
    expect(detalhes().map((item) => [item.id, item.alteraVencimento])).toEqual([
      [segundo.pagamento.id, true], [primeiro.pagamento.id, false],
    ]);
    expect(() => servicos.financeiro.editarPagamento(primeiro.pagamento.id, { dataPagamento: '2026-10-16' })).toThrow(RECUSA);
  });
});

describe('editar pagamento', () => {
  it('muda a data do último pagamento, refaz o vencimento e mantém id e criação', () => {
    pagar({ dataPagamento: '2026-08-15' });
    const ultimo = pagar();
    const resposta = servicos.financeiro.editarPagamento(ultimo.pagamento.id, { dataPagamento: '2026-10-20' });
    expect(resposta).toMatchObject({ ok: true, dataFimNova: '2026-11-20', pagamento: {
      id: ultimo.pagamento.id, criadoEm: ultimo.pagamento.criadoEm, dataPagamento: '2026-10-20', alteraVencimento: true,
    } });
    expect(atual()).toMatchObject({ dataInicio: '2026-10-20', dataFim: '2026-11-20', diaAncora: 20 });
    expect(detalhes()).toHaveLength(2);
  });

  it('recalcula a partir do vencimento anterior quando a data corrigida é adiantada', () => {
    pagar();
    const segundo = pagar();
    expect(servicos.financeiro.editarPagamento(segundo.pagamento.id, { dataPagamento: '2026-10-25' }).dataFimNova).toBe('2026-12-15');
    expect(atual()!.diaAncora).toBe(15);
  });

  it('troca o plano e aplica os períodos pelo cálculo de renovação existente', () => {
    const registro = pagar();
    const trimestral = banco.db.insert(plano).values({ nome: 'Trimestral', precoCentavos: 35000, duracaoMeses: 3 }).returning().get();
    const resposta = servicos.financeiro.editarPagamento(registro.pagamento.id, { planoId: trimestral.id, periodos: 2, valorCentavos: 70000 });
    expect(resposta).toMatchObject({ dataFimNova: '2027-04-15', pagamento: { planoId: trimestral.id, planoNome: 'Trimestral', valorCentavos: 70000 } });
    expect(atual()).toMatchObject({ dataFim: '2027-04-15', valorCentavos: 70000 });
  });

  it.each(['adiantamento', 'manual', 'diária'])('editar só valor preserva o período: %s', (tipo) => {
    const campos: Parameters<typeof pagar>[0] = tipo === 'adiantamento' ? { periodos: 3 } : { dataFimManual: '2026-12-28' };
    if (tipo === 'diária') {
      campos.planoId = banco.db.insert(plano).values({ nome: 'Diária', precoCentavos: 2500, duracaoMeses: 0, duracaoDias: 1 }).returning().get().id;
      campos.dataInicioEscolhida = '2026-10-25';
      delete campos.dataFimManual;
    }
    const registro = pagar(campos);
    const resposta = servicos.financeiro.editarPagamento(registro.pagamento.id, { valorCentavos: 15000 });
    expect(resposta).toMatchObject({ dataFimNova: registro.matricula!.dataFim, pagamento: { id: registro.pagamento.id, valorCentavos: 15000 } });
    expect(atual()).toMatchObject({ dataInicio: registro.matricula!.dataInicio, dataFim: registro.matricula!.dataFim, diaAncora: registro.matricula!.diaAncora });
  });

  it('corrigir só o valor do último pagamento não refaz a matrícula nem apaga a cobrança em aberto', () => {
    const registro = pagar();
    const aberta = cobrar(registro.matricula!.id, '2026-11');
    const antes = estado().matriculas;
    servicos.financeiro.editarPagamento(registro.pagamento.id, { valorCentavos: 15000, forma: 'dinheiro' });
    expect(estado().matriculas).toEqual(antes);
    expect(estado().cobrancas).toEqual([expect.objectContaining({ id: aberta.id, status: 'aberta' })]);
  });

  it('edita valor, forma e observação de pagamento antigo sem mexer nas matrículas', () => {
    const primeiro = pagar();
    pagar();
    const antes = estado().matriculas;
    const resposta = servicos.financeiro.editarPagamento(primeiro.pagamento.id, {
      valorCentavos: 15000, forma: 'debito', observacao: '', dataPagamento: primeiro.pagamento.dataPagamento, planoId,
    });
    expect(resposta.pagamento).toMatchObject({ valorCentavos: 15000, forma: 'debito', observacao: '', alteraVencimento: false });
    expect(resposta.dataFimNova).toBe('2026-12-15');
    expect(estado().matriculas).toEqual(antes);
  });

  it.each([{ dataPagamento: '2026-10-20' }, { planoId: 999 }, { periodos: 2 }])('recusa mudança de período antigo: %j', (campos) => {
    const primeiro = pagar();
    pagar();
    const antes = estado();
    expect(() => servicos.financeiro.editarPagamento(primeiro.pagamento.id, campos)).toThrow(RECUSA);
    expect(estado()).toEqual(antes);
  });

  it('edita data do avulso sem alterar matrícula de outro pagamento', () => {
    pagar();
    const avulso = pagar({ planoId: undefined });
    const antes = estado().matriculas;
    const resposta = servicos.financeiro.editarPagamento(avulso.pagamento.id, { dataPagamento: '2026-10-01', valorCentavos: 1000, forma: 'dinheiro', observacao: 'Corrigido' });
    expect(resposta.pagamento).toMatchObject({ dataPagamento: '2026-10-01', valorCentavos: 1000, forma: 'dinheiro', observacao: 'Corrigido', matriculaId: null });
    expect(estado().matriculas).toEqual(antes);
  });

  it('permite adicionar plano e períodos ao avulso, mantendo o id', () => {
    const avulso = pagar({ planoId: undefined });
    const resposta = servicos.financeiro.editarPagamento(avulso.pagamento.id, { planoId, periodos: 2, dataPagamento: '2026-10-20' });
    expect(resposta).toMatchObject({ dataFimNova: '2026-12-20', pagamento: { id: avulso.pagamento.id, planoId, alteraVencimento: true } });
    expect(detalhes()).toHaveLength(1);
  });

  it('avulso sem matrícula devolve vencimento nulo', () => {
    const avulso = pagar({ planoId: undefined });
    expect(servicos.financeiro.editarPagamento(avulso.pagamento.id, { valorCentavos: 1200 }).dataFimNova).toBeNull();
  });

  it('mantém a cobrança quitada e o responsável, removendo a cobrança automática do período desfeito', () => {
    const pessoa = banco.db.insert(usuario).values({ nome: 'Dono', email: 'dono@teste', papel: 'dono' }).returning().get();
    const primeiro = pagar();
    const quitada = cobrar(primeiro.matricula!.id, '2026-11');
    const cancelada = cobrar(primeiro.matricula!.id, '2026-10', 'cancelada');
    const segundo = pagar({ cobrancaId: quitada.id, usuarioId: pessoa.id });
    const automatica = cobrar(segundo.matricula!.id, '2026-12');
    const resposta = servicos.financeiro.editarPagamento(segundo.pagamento.id, { dataPagamento: '2026-11-20' });
    expect(resposta.pagamento).toMatchObject({ cobrancaId: quitada.id, registradoPorUsuarioId: pessoa.id });
    expect(estado().cobrancas).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: quitada.id, status: 'paga' }), expect.objectContaining({ id: cancelada.id, status: 'cancelada' }),
    ]));
    expect(estado().cobrancas.some((c) => c.id === automatica.id)).toBe(false);
    expect(servicos.financeiro.excluirPagamento(segundo.pagamento.id).dataFimNova).toBe(primeiro.matricula!.dataFim);
  });

  it.each(['plano inexistente', 'plano inativo', 'falha ao gravar', 'períodos inválidos', 'diária adiantada'])('faz rollback integral: %s', (caso) => {
    const primeiro = pagar();
    const quitada = cobrar(primeiro.matricula!.id, '2026-11');
    const segundo = pagar({ cobrancaId: quitada.id });
    cobrar(segundo.matricula!.id, '2026-12');
    let campos: Parameters<typeof servicos.financeiro.editarPagamento>[1] = { dataPagamento: '2026-11-20' };
    if (caso === 'plano inexistente') campos.planoId = 999;
    if (caso === 'plano inativo') banco.db.update(plano).set({ ativo: false }).run();
    if (caso === 'períodos inválidos') campos.periodos = 13;
    if (caso === 'diária adiantada') {
      campos = { periodos: 2, planoId: banco.db.insert(plano).values({ nome: 'Diária', precoCentavos: 2500, duracaoMeses: 0, duracaoDias: 1 }).returning().get().id };
    }
    if (caso === 'falha ao gravar') banco.sqlite.exec("CREATE TRIGGER falha_edicao BEFORE INSERT ON pagamento BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;");
    const antes = estado();
    expect(() => servicos.financeiro.editarPagamento(segundo.pagamento.id, campos)).toThrow();
    expect(estado()).toEqual(antes);
  });

  it('preserva matrícula com cobrança vinculada a outro pagamento', () => {
    const primeiro = pagar();
    const proxima = cobrar(primeiro.matricula!.id, '2026-11');
    pagar({ planoId: undefined, cobrancaId: proxima.id });
    const antes = estado();
    expect(() => servicos.financeiro.editarPagamento(primeiro.pagamento.id, { dataPagamento: '2026-10-20' }))
      .toThrow('Exclua primeiro o pagamento mais recente deste aluno.');
    expect(estado()).toEqual(antes);
  });
});

describe('histórico de pagamentos', () => {
  it('soma o mês inteiro, agrupa formas e dias e ordena por data e id decrescentes', () => {
    pagar({ dataPagamento: '2026-09-30' });
    const inicio = pagar({ dataPagamento: '2026-10-01', valorCentavos: 1000 });
    const fim = pagar({ dataPagamento: '2026-10-31', valorCentavos: 2000, forma: 'dinheiro' });
    const empate = pagar({ dataPagamento: '2026-10-31', valorCentavos: 500 });
    pagar({ dataPagamento: '2026-11-01' });
    banco.db.update(aluno).set({ ativo: false }).run();
    const resposta = servicos.financeiro.historico({ mes: '2026-10' });
    expect(Object.keys(resposta).sort()).toEqual(['itens', 'meses', 'porDia', 'porForma', 'quantidade', 'totalCentavos']);
    expect(resposta.itens.map((item) => item.id)).toEqual([empate.pagamento.id, fim.pagamento.id, inicio.pagamento.id]);
    expect(resposta).toMatchObject({ totalCentavos: 3500, quantidade: 3, porForma: [
      { forma: 'dinheiro', totalCentavos: 2000, quantidade: 1 }, { forma: 'pix', totalCentavos: 1500, quantidade: 2 },
    ], porDia: [{ data: '2026-10-01', totalCentavos: 1000 }, { data: '2026-10-31', totalCentavos: 2500 }] });
  });

  it('busca sem acento atravessa meses e combina com o mês por interseção', () => {
    const setembro = pagar({ dataPagamento: '2026-09-15', valorCentavos: 1000 });
    const outubro = pagar({ valorCentavos: 2000 });
    const outra = banco.db.insert(aluno).values({ nome: 'Ana', telefone: '+5511999990002' }).returning().get();
    pagar({ alunoId: outra.id, valorCentavos: 3000 });
    const busca = servicos.financeiro.historico({ busca: '  JOSE  ' });
    expect(busca.itens.map((item) => item.id)).toEqual([outubro.pagamento.id, setembro.pagamento.id]);
    expect(busca).toMatchObject({ totalCentavos: 3000, quantidade: 2, porDia: [] });
    const intersecao = servicos.financeiro.historico({ mes: '2026-10', busca: 'CONCEICAO' });
    expect(intersecao.itens.map((item) => item.id)).toEqual([outubro.pagamento.id]);
    expect(intersecao).toMatchObject({ totalCentavos: 2000, quantidade: 1, porDia: [{ data: '2026-10-15', totalCentavos: 2000 }] });
    expect(servicos.financeiro.historico({ busca: '99990001' }).itens).toEqual([]);
  });

  it('não limita o mês e limita só a busca a 500, depois de filtrar e ordenar', () => {
    banco.db.transaction((tx) => {
      for (let i = 0; i < 505; i++) tx.insert(pagamento).values({ alunoId, valorCentavos: 100, forma: 'pix', dataPagamento: '2026-10-15' }).run();
    });
    expect(servicos.financeiro.historico({ mes: '2026-10' })).toMatchObject({ quantidade: 505, totalCentavos: 50500 });
    expect(servicos.financeiro.historico({ mes: '2026-10', busca: 'jose' }).itens).toHaveLength(505);
    const busca = servicos.financeiro.historico({ busca: 'jose' });
    expect(busca).toMatchObject({ quantidade: 500, totalCentavos: 50000 });
    expect(busca.itens[0].id).toBe(505);
    expect(busca.itens.at(-1)!.id).toBe(6);
  });

  it('sempre traz 12 meses até o atual, inclusive zeros, sem depender dos filtros', () => {
    const inicioAtual = `${hoje().slice(0, 7)}-01`;
    const meses = Array.from({ length: 12 }, (_, i) => adicionarMeses(inicioAtual, i - 11, 1).slice(0, 7));
    pagar({ dataPagamento: `${meses[0]}-01`, valorCentavos: 1000 });
    pagar({ dataPagamento: inicioAtual, valorCentavos: 2000 });
    pagar({ dataPagamento: adicionarMeses(inicioAtual, -12, 1) });
    pagar({ dataPagamento: adicionarMeses(inicioAtual, 1, 1) });
    const resposta = servicos.financeiro.historico({ mes: '2020-01', busca: 'não existe' });
    expect(resposta).toMatchObject({ itens: [], totalCentavos: 0, quantidade: 0, porForma: [], porDia: [] });
    expect(resposta.meses).toEqual(meses.map((mes, i) => ({ mes, totalCentavos: i === 0 ? 1000 : i === 11 ? 2000 : 0, quantidade: i === 0 || i === 11 ? 1 : 0 })));
    expect(servicos.financeiro.historico({ busca: 'jose' }).meses).toEqual(resposta.meses);
    expect(servicos.financeiro.historico()).toMatchObject({ totalCentavos: 2000, quantidade: 1 });
  });

  it.each(['2024-02', '2026-12'])('respeita o fim de mês e a virada de ano: %s', (mes) => {
    pagar({ dataPagamento: `${mes}-01`, valorCentavos: 1000 });
    pagar({ dataPagamento: adicionarMeses(`${mes}-01`, 1, 1), valorCentavos: 2000 });
    expect(servicos.financeiro.historico({ mes })).toMatchObject({ totalCentavos: 1000, quantidade: 1 });
  });
});

describe('rotas do contrato', () => {
  beforeEach(async () => {
    const pessoas = banco.db.insert(usuario).values([
      { nome: 'Dono', email: 'dono@teste', papel: 'dono', senhaHash },
      { nome: 'Recepção', email: 'recepcao@teste', papel: 'recepcao', senhaHash },
      { nome: 'Professor', email: 'professor@teste', papel: 'professor', senhaHash },
    ]).returning().all();
    banco.db.insert(sessao).values(pessoas.map((p) => ({ usuarioId: p.id, token: p.papel, expiraEm: '2099-01-01T00:00:00.000Z' }))).run();
    servidor = construirServidor({ db: banco.db });
    await servidor.ready();
  });
  const consultar = (url: string, papel = 'dono') => servidor!.inject({ method: 'GET', url, headers: { authorization: `Bearer ${papel}` } });
  const editar = (id: number | string, campos = {}, papel = 'dono') => servidor!.inject({
    method: 'PUT', url: `/api/pagamentos/${id}`, payload: { senha: SENHA, ...campos }, headers: { authorization: `Bearer ${papel}` },
  });

  it('PUT devolve exatamente o contrato, com o pagamento detalhado', async () => {
    const registro = pagar();
    const resposta = await editar(registro.pagamento.id, { dataPagamento: '2026-10-20' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, pagamento: detalhes()[0], dataFimNova: '2026-11-20' });
  });

  it('senha errada não altera nada', async () => {
    const registro = pagar();
    const antes = estado();
    const resposta = await editar(registro.pagamento.id, { senha: 'incorreta', valorCentavos: 1 });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: 'Senha incorreta.' });
    expect(estado()).toEqual(antes);
  });

  it.each(['recepcao', 'professor'])('PUT recusa %s com 403', async (papel) => {
    const registro = pagar();
    const antes = estado();
    expect((await editar(registro.pagamento.id, { valorCentavos: 1 }, papel)).statusCode).toBe(403);
    expect(estado()).toEqual(antes);
  });

  it('as novas rotas exigem sessão', async () => {
    expect((await servidor!.inject({ method: 'GET', url: '/api/pagamentos/historico' })).statusCode).toBe(401);
    expect((await servidor!.inject({ method: 'PUT', url: '/api/pagamentos/1', payload: { senha: SENHA } })).statusCode).toBe(401);
  });

  it.each(['dono', 'recepcao'])('histórico e ficha entregam detalhes para %s', async (papel) => {
    pagar();
    const historico = await consultar('/api/pagamentos/historico?mes=2026-10&busca=jose', papel);
    const ficha = await consultar(`/api/alunos/${alunoId}/pagamentos`, papel);
    expect(historico.statusCode).toBe(200);
    expect(ficha.statusCode).toBe(200);
    expect(historico.json().itens).toEqual(detalhes());
    expect(ficha.json()).toEqual(detalhes());
  });

  it('professor não lê o histórico nem os pagamentos da ficha', async () => {
    expect((await consultar('/api/pagamentos/historico', 'professor')).statusCode).toBe(403);
    expect((await consultar(`/api/alunos/${alunoId}/pagamentos`, 'professor')).statusCode).toBe(403);
  });

  it.each(['jose', 'JOSÉ', 'conceicao', 'CONCEIÇÃO', '(11) 99999-0001'])('busca de alunos encontra nome ou telefone: %s', async (busca) => {
    banco.db.insert(aluno).values({ nome: 'Outra pessoa', telefone: '+5511888880002' }).run();
    const resposta = await consultar(`/api/alunos?${new URLSearchParams({ busca })}`);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().map((a: { id: number }) => a.id)).toEqual([alunoId]);
  });

  it('busca mantém filtros de status e de aluno ativo e trata texto como literal', async () => {
    expect((await consultar('/api/alunos?busca=jose&status=ativo')).json()).toEqual([]);
    expect((await consultar(`/api/alunos?${new URLSearchParams({ busca: "%' OR TRUE --" })}`)).json()).toEqual([]);
    banco.db.update(aluno).set({ ativo: false }).run();
    expect((await consultar('/api/alunos?busca=jose')).json()).toEqual([]);
  });

  it('pagamento antigo responde 400 com a mensagem exata', async () => {
    const primeiro = pagar();
    pagar();
    const resposta = await editar(primeiro.pagamento.id, { dataPagamento: '2026-10-20' });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro: RECUSA });
  });

  it.each([
    { senha: undefined }, { senha: '' }, { senha: 'x'.repeat(1025) }, { dataPagamento: '2026-02-30' },
    { valorCentavos: 0 }, { valorCentavos: 1.5 }, { forma: 'transferencia' }, { planoId: 0 },
    { periodos: 0 }, { periodos: 13 }, { periodos: 1.5 }, { observacao: 'x'.repeat(201) }, { alunoId: 999 },
  ])('valida o corpo antes de editar: %j', async (campos) => {
    const registro = pagar();
    const antes = estado();
    expect((await editar(registro.pagamento.id, campos)).statusCode).toBe(400);
    expect(estado()).toEqual(antes);
  });

  it('valida o identificador e devolve 404 se o pagamento não existe', async () => {
    expect((await editar('invalido')).statusCode).toBe(400);
    const resposta = await editar(999);
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Pagamento não encontrado' });
  });

  it.each(['mes=2026-00', 'mes=2026-13', 'mes=outubro', 'mes=2026-1', `busca=${'x'.repeat(201)}`])('valida filtros do histórico: %s', async (consulta) => {
    expect((await consultar(`/api/pagamentos/historico?${consulta}`)).statusCode).toBe(400);
  });
});
