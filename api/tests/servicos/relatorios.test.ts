import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoRelatorios } from '../../src/servicos/relatorios.js';
import { criarServicoFinanceiro } from '../../src/servicos/financeiro.js';
import { aluno, plano, academia } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let rel: ReturnType<typeof criarServicoRelatorios>;
let fin: ReturnType<typeof criarServicoFinanceiro>;
let ana: number, bia: number, mensal: number, trimestral: number;

beforeEach(() => {
  t = criarBancoDeTeste();
  rel = criarServicoRelatorios(t.db as any);
  fin = criarServicoFinanceiro(t.db as any);
  t.db.insert(academia).values({ nome: 'DARK FISIC' }).run();
  ana = t.db.insert(aluno).values({ nome: 'Ana', telefone: '+5514990000001' }).returning().get().id;
  bia = t.db.insert(aluno).values({ nome: 'Bia', telefone: '+5514990000002' }).returning().get().id;
  mensal = t.db.insert(plano).values({ nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1 }).returning().get().id;
  trimestral = t.db.insert(plano).values({ nome: 'Trimestral', precoCentavos: 24000, duracaoMeses: 3 }).returning().get().id;
});
afterEach(() => t.fechar());

const pagar = (alunoId: number, valor: number, forma: any, data: string, planoId?: number) =>
  fin.registrarPagamento({ alunoId, valorCentavos: valor, forma, dataPagamento: data, planoId });

describe('receita por mes', () => {
  it('devolve os ultimos meses em ordem, inclusive os sem nada', () => {
    pagar(ana, 9000, 'pix', '2026-08-10');
    pagar(ana, 9000, 'pix', '2026-10-10');
    pagar(bia, 7500, 'dinheiro', '2026-10-12');

    const serie = rel.receitaPorMes('2026-10', 3);
    expect(serie).toEqual([
      { mes: '2026-08', totalCentavos: 9000, pagamentos: 1 },
      { mes: '2026-09', totalCentavos: 0, pagamentos: 0 },
      { mes: '2026-10', totalCentavos: 16500, pagamentos: 2 },
    ]);
  });

  it('nao mistura o mes seguinte', () => {
    pagar(ana, 9000, 'pix', '2026-11-01');
    expect(rel.receitaPorMes('2026-10', 2).at(-1)).toEqual({ mes: '2026-10', totalCentavos: 0, pagamentos: 0 });
  });
});

describe('formas de pagamento', () => {
  it('soma por forma no periodo, da maior para a menor', () => {
    pagar(ana, 9000, 'pix', '2026-10-01');
    pagar(bia, 9000, 'pix', '2026-10-02');
    pagar(ana, 7500, 'dinheiro', '2026-10-03');
    pagar(bia, 5000, 'credito', '2026-09-30');   // fora do mes

    expect(rel.formasDoMes('2026-10')).toEqual([
      { forma: 'pix', totalCentavos: 18000, quantidade: 2 },
      { forma: 'dinheiro', totalCentavos: 7500, quantidade: 1 },
    ]);
  });
});

describe('relatorio do mes', () => {
  it('junta os numeros que o dono olha', () => {
    pagar(ana, 9000, 'pix', '2026-10-05', mensal);
    pagar(bia, 24000, 'dinheiro', '2026-10-06', trimestral);

    const r = rel.doMes('2026-10');
    expect(r).toMatchObject({
      mes: '2026-10',
      academia: 'DARK FISIC',
      receitaCentavos: 33000,
      pagamentos: 2,
      ticketMedioCentavos: 16500,
    });
    expect(r.formas[0]).toEqual({ forma: 'dinheiro', totalCentavos: 24000, quantidade: 1 });
    // empate em alunos: ordem alfabetica, para a lista nao dancar a cada carga
    expect(r.porPlano).toEqual([{ plano: 'Mensal', alunos: 1 }, { plano: 'Trimestral', alunos: 1 }]);
  });

  it('mes sem movimento nao quebra nem divide por zero', () => {
    const r = rel.doMes('2026-10');
    expect(r).toMatchObject({ receitaCentavos: 0, pagamentos: 0, ticketMedioCentavos: 0 });
    expect(r.formas).toEqual([]);
  });

  it('compara com o mes anterior', () => {
    pagar(ana, 10000, 'pix', '2026-09-10');
    pagar(bia, 15000, 'pix', '2026-10-10');
    const r = rel.doMes('2026-10');
    expect(r.mesAnteriorCentavos).toBe(10000);
    expect(r.variacaoPct).toBe(50);
  });

  it('sem mes anterior, nao inventa porcentagem', () => {
    pagar(ana, 15000, 'pix', '2026-10-10');
    expect(rel.doMes('2026-10').variacaoPct).toBeNull();
  });
});

describe('texto para o WhatsApp', () => {
  it('cabe numa mensagem e tem os numeros principais', () => {
    pagar(ana, 9000, 'pix', '2026-10-05', mensal);
    const texto = rel.textoDoMes('2026-10');
    expect(texto).toContain('DARK FISIC');
    expect(texto).toContain('outubro');
    expect(texto).toContain('R$ 90,00');
    expect(texto.length).toBeLessThan(900);
  });
});
