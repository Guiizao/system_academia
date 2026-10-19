import { describe, it, expect } from 'vitest';
import { descreverCobertura } from '../src/componentes/Pagamentos';
import { somarMes } from '../src/telas/TodosPagamentos';
import type { PagamentoDetalhe, Plano } from '../src/tipos';

const plano = (p: Partial<Plano>): Plano => ({
  id: 1, nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1, duracaoDias: null,
  beneficios: [], destaque: false, ordem: 0, ativo: true, ...p,
});
const pag = (p: Partial<PagamentoDetalhe>): PagamentoDetalhe => ({
  id: 1, alunoId: 1, alunoNome: 'José', valorCentavos: 13900, forma: 'pix', dataPagamento: '2026-10-10',
  observacao: null, matriculaId: 1, planoId: 1, planoNome: 'Plus', alteraVencimento: true,
  periodos: 1, registradoPorNome: null, editado: false, ...p,
});

describe('o que cada pagamento cobriu', () => {
  it('um mês do plano mensal: só o nome do plano', () => {
    expect(descreverCobertura(pag({}), [plano({})])).toBe('Plus');
  });

  it('pagou adiantado: diz quantos meses', () => {
    expect(descreverCobertura(pag({ periodos: 2 }), [plano({})])).toBe('Plus, 2 meses');
  });

  it('plano de 3 meses: diz o período e o total em meses', () => {
    expect(descreverCobertura(pag({ planoNome: 'Trimestral', periodos: 1 }), [plano({ nome: 'Trimestral', duracaoMeses: 3 })]))
      .toBe('Trimestral, 1 período (3 meses)');
  });

  it('diária não fala em meses', () => {
    expect(descreverCobertura(pag({ planoNome: 'Diária', periodos: 1 }), [plano({ nome: 'Diária', duracaoDias: 1 })])).toBe('Diária');
  });

  it('avulso sem plano mostra a observação', () => {
    expect(descreverCobertura(pag({ planoId: null, planoNome: null, periodos: null, observacao: 'Taxa de matrícula' }), [])).toBe('Taxa de matrícula');
  });

  it('plano desativado (fora da lista) ainda mostra o nome', () => {
    expect(descreverCobertura(pag({ periodos: 3 }), [])).toBe('Plus');
  });
});

describe('andar de mês em mês', () => {
  it('vira o ano para a frente e para trás', () => {
    expect(somarMes('2026-12', 1)).toBe('2027-01');
    expect(somarMes('2026-01', -1)).toBe('2025-12');
    expect(somarMes('2026-10', -11)).toBe('2025-11');
  });
});
