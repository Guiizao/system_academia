import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoFinanceiro } from '../../src/servicos/financeiro.js';
import { criarServicoMatriculas } from '../../src/servicos/matriculas.js';
import { aluno, plano, academia, cobranca } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let fin: ReturnType<typeof criarServicoFinanceiro>;
let mat: ReturnType<typeof criarServicoMatriculas>;
let alunoId: number, outroAluno: number, planoId: number;

beforeEach(() => {
  t = criarBancoDeTeste();
  fin = criarServicoFinanceiro(t.db as any);
  mat = criarServicoMatriculas(t.db as any);
  t.db.insert(academia).values({
    nome: 'DARK FISIC', pixChave: 'darkfisic@email.com',
    pixNomeRecebedor: 'DARK FISIC ACADEMIA', pixCidade: 'SAO PAULO',
  }).run();
  alunoId = t.db.insert(aluno).values({ nome: 'Juliana', telefone: '+5511980002222' }).returning().get().id;
  outroAluno = t.db.insert(aluno).values({ nome: 'Carla', telefone: '+5511980004444' }).returning().get().id;
  planoId = t.db.insert(plano).values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning().get().id;
});
afterEach(() => t.fechar());

const novaCobranca = (aId: number, venc: string) =>
  t.db.insert(cobranca).values({
    alunoId: aId, competencia: venc.slice(0, 7), valorCentavos: 13900, vencimento: venc,
  }).returning().get();

describe('registrarPagamento', () => {
  it('grava, quita a cobranca e renova a matricula de uma vez', async () => {
    const c = novaCobranca(alunoId, '2026-09-10');
    const r = fin.registrarPagamento({
      alunoId, valorCentavos: 13900, forma: 'pix', cobrancaId: c.id, planoId, dataPagamento: '2026-09-10',
    });
    expect(r.pagamento.valorCentavos).toBe(13900);
    expect(r.matricula?.dataFim).toBe('2026-10-10');
    // data fixa: sem ela o teste passa ou falha conforme o dia em que roda --
    // perto do vencimento o sistema já gera a cobrança do período seguinte
    expect(fin.cobrancasAbertas('2026-09-15')).toHaveLength(0);
    expect((await mat.statusDe(alunoId, '2026-09-15')).status).toBe('ativo');
  });

  it('se a renovacao falhar, o pagamento NAO fica gravado pela metade', () => {
    const c = novaCobranca(alunoId, '2026-09-10');
    expect(() => fin.registrarPagamento({
      alunoId, valorCentavos: 13900, forma: 'pix', cobrancaId: c.id, planoId: 9999,
    })).toThrow('Plano não encontrado');
    expect(fin.pagamentosDoAluno(alunoId)).toHaveLength(0);
    expect(fin.cobrancasAbertas()).toHaveLength(1); // cobranca continua aberta
  });

  it('recusa quitar cobranca de outro aluno', () => {
    const c = novaCobranca(outroAluno, '2026-09-10');
    expect(() => fin.registrarPagamento({
      alunoId, valorCentavos: 13900, forma: 'pix', cobrancaId: c.id,
    })).toThrow('outro aluno');
  });

  it('recusa quitar a mesma cobranca duas vezes', () => {
    const c = novaCobranca(alunoId, '2026-09-10');
    fin.registrarPagamento({ alunoId, valorCentavos: 13900, forma: 'pix', cobrancaId: c.id });
    expect(() => fin.registrarPagamento({
      alunoId, valorCentavos: 13900, forma: 'pix', cobrancaId: c.id,
    })).toThrow('já quitada');
  });

  it('recusa valor nao inteiro', () => {
    expect(() => fin.registrarPagamento({ alunoId, valorCentavos: 139.5, forma: 'pix' }))
      .toThrow('inteiro em centavos');
  });
});

describe('indicadores', () => {
  it('inadimplencia soma so cobrancas abertas ja vencidas', () => {
    novaCobranca(alunoId, '2026-09-01');    // vencida
    novaCobranca(outroAluno, '2026-09-30'); // a vencer
    expect(fin.inadimplencia('2026-09-15')).toBe(13900);
  });

  it('receita do mes soma pagamentos do mes', () => {
    fin.registrarPagamento({ alunoId, valorCentavos: 13900, forma: 'pix', dataPagamento: '2026-09-05' });
    fin.registrarPagamento({ alunoId: outroAluno, valorCentavos: 8900, forma: 'dinheiro', dataPagamento: '2026-09-20' });
    fin.registrarPagamento({ alunoId, valorCentavos: 5000, forma: 'pix', dataPagamento: '2026-08-31' });
    expect(fin.receitaDoMes('2026-09')).toBe(22800);
  });

  it('pix da cobranca gera BR Code com o valor dela', () => {
    const c = novaCobranca(alunoId, '2026-09-10');
    const pix = fin.pixDaCobranca(c.id);
    expect(pix.payload).toContain('5406139.00');
    expect(pix.payload).toContain('COB' + c.id);
  });
});

describe('pix avulso (renovacao sem cobranca em aberto)', () => {
  it('gera BR Code com o valor pedido', () => {
    const pix = fin.pixAvulso(36900);
    expect(pix.payload).toContain('5406369.00');
    expect(pix.payload).toContain('darkfisic@email.com');
  });
  it('recusa valor que nao e centavo inteiro positivo', () => {
    expect(() => fin.pixAvulso(0)).toThrow();
    expect(() => fin.pixAvulso(10.5)).toThrow();
  });
  it('sem chave Pix configurada, explica o que falta', () => {
    t.db.update(academia).set({ pixChave: null }).run();
    expect(() => fin.pixAvulso(13900)).toThrow('Chave Pix');
  });
});
