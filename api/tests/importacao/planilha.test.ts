import { describe, it, expect } from 'vitest';
import {
  converterPlanilhaMensalidades, nomeProprio, telefoneDaPlanilha, valorEmCentavos,
} from '../../src/importacao/planilha.js';

// Planilha sintetica no formato do "Controle de Mensalidades" (nomes inventados).
// Como na planilha real, setembro e outubro trazem Valor e Forma em ordens diferentes.
const SET = ['Situação', 'Data Pgto', 'Próx. Vencimento', 'Status', 'Dias Atraso', 'Forma Pgto', ' Valor ', 'Mensagem'];
const OUT = ['Situação', 'Data Pgto', 'Próx. Vencimento', 'Status', 'Dias Atraso', ' Valor ', 'Forma Pgto', 'Mensagem'];
type Mes = { situacao: string; data?: string; venc?: string; forma?: string; valor?: string };
type Linha = { nome: string; whats?: string; set?: Mes; out?: Mes };

function celulas(campos: string[], m?: Mes): string[] {
  const valor: Record<string, string> = {
    'Situação': m?.situacao ?? '', 'Data Pgto': m?.data ?? '', 'Próx. Vencimento': m?.venc ?? '',
    'Forma Pgto': m?.forma ?? '', ' Valor ': m?.valor ?? '', 'Mensagem': m ? 'Olá!' : '',
  };
  return campos.map((c) => valor[c] ?? '');
}
function planilha(linhas: Linha[]): string {
  const bloco = (mes: string, campos: string[]) => [mes, ...campos.slice(1).map(() => '')];
  const h1 = ['Cliente', 'Status Cliente', 'WhatsApp', 'Link WhatsApp', ...bloco('Setembro', SET), ...bloco('Outubro', OUT)];
  const h2 = ['', '', '', '', ...SET, ...OUT];
  const corpo = linhas.map((l) => [l.nome, 'Ativo', l.whats ?? '', '', ...celulas(SET, l.set), ...celulas(OUT, l.out)]);
  return '﻿' + [h1, h2, ...corpo, ['', '', '', '']].map((l) => l.join(';')).join('\r\n');
}
const pago = (data: string, venc: string, forma: string, valor: string): Mes => ({ situacao: 'Pago', data, venc, forma, valor });

describe('nomeProprio', () => {
  it('maiusculas viram nome proprio, com particulas em minusculas', () => {
    expect(nomeProprio('  ANA PAULA DOS  SANTOS ')).toBe('Ana Paula dos Santos');
    expect(nomeProprio('MARIA DE A LIMA')).toBe('Maria de A Lima');
    expect(nomeProprio('joão da silva e souza')).toBe('João da Silva e Souza');
  });
});

describe('telefoneDaPlanilha', () => {
  it('celular com DDD vira E.164', () => expect(telefoneDaPlanilha('14 99777-1193', '14')).toBe('+5514997771193'));
  it('sem DDD usa o DDD da academia', () => expect(telefoneDaPlanilha('997771193', '14')).toBe('+5514997771193'));
  it('ja com 55 na frente', () => expect(telefoneDaPlanilha('5514997771193', '14')).toBe('+5514997771193'));
  it('vazio ou invalido vira null', () => {
    expect(telefoneDaPlanilha('', '14')).toBeNull();
    expect(telefoneDaPlanilha('123', '14')).toBeNull();
  });
});

describe('valorEmCentavos', () => {
  it('le o formato brasileiro', () => {
    expect(valorEmCentavos(' R$ 90,00 ')).toBe(9000);
    expect(valorEmCentavos('R$ 1.188,50')).toBe(118850);
    expect(valorEmCentavos('90')).toBe(9000);
    expect(valorEmCentavos('')).toBeNull();
  });

  it('recusa o que nao e valor em reais, em vez de chutar', () => {
    expect(valorEmCentavos('90.00')).toBeNull();   // ponto decimal nao e o formato da planilha
    expect(valorEmCentavos('1e3')).toBeNull();
    expect(valorEmCentavos('0x10')).toBeNull();
    expect(valorEmCentavos('noventa')).toBeNull();
  });
});

describe('converterPlanilhaMensalidades', () => {
  it('cria um plano Mensal com o valor mais comum e um "com personal" para cada desconto', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'ANA LIMA', whats: '14991110000', set: pago('01/09/2026', '01/10/2026', 'Pix', ' R$ 90,00 ') },
      { nome: 'BIA COSTA', set: pago('02/09/2026', '02/10/2026', 'Crédito', ' R$ 90,00 ') },
      { nome: 'CAIO REIS', set: pago('05/09/2026', '05/10/2026', 'Dinheiro', ' R$ 75,00 ') },
    ]));
    expect(r.planos).toEqual([
      { nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1 },
      { nome: 'Mensal com personal (R$ 75)', precoCentavos: 7500, duracaoMeses: 1 },
    ]);
    const caio = r.alunos.find((a) => a.nome === 'Caio Reis')!;
    expect(caio.plano).toBe('Mensal com personal (R$ 75)');
    expect(caio.pagamentos).toEqual([{ data: '2026-09-05', valorCentavos: 7500, forma: 'dinheiro' }]);
  });

  it('matricula vem do mes mais recente e todos os pagamentos entram', () => {
    const r = converterPlanilhaMensalidades(planilha([{
      nome: 'DANI PRADO', whats: '14992220000',
      set: pago('03/09/2026', '03/10/2026', 'Pix', ' R$ 90,00 '),
      out: pago('01/10/2026', '03/11/2026', 'PIX', ' R$ 90,00 '),
    }]));
    const [dani] = r.alunos;
    expect(dani.telefone).toBe('+5514992220000');
    expect(dani.aceitaWhatsapp).toBe(true);
    expect(dani.matricula).toEqual({ dataInicio: '2026-10-01', dataFim: '2026-11-03' });
    expect(dani.pagamentos.map((p) => [p.data, p.forma])).toEqual([['2026-09-03', 'pix'], ['2026-10-01', 'pix']]);
  });

  it('"A Receber" entra com matricula ate o vencimento e sem pagamento', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'EDU LOPES', set: { situacao: 'A Receber', venc: '10/09/2026', valor: ' R$ 85,00 ' } },
      // empate de 1 a 1: o valor maior vira o "Mensal"
      { nome: 'ZE PAGO', set: pago('02/09/2026', '02/10/2026', 'Pix', ' R$ 90,00 ') },
    ]));
    const edu = r.alunos.find((a) => a.nome === 'Edu Lopes')!;
    expect(edu.matricula).toEqual({ dataInicio: '2026-08-10', dataFim: '2026-09-10' });
    expect(edu.plano).toBe('Mensal com personal (R$ 85)');
    expect(edu.pagamentos).toEqual([]);
    expect(edu.telefone).toBeNull();
    expect(edu.aceitaWhatsapp).toBe(false);
  });

  it('sem nenhum vencimento: entra sem plano nem matricula', () => {
    const r = converterPlanilhaMensalidades(planilha([{ nome: 'FABI MOURA' }]));
    expect(r.alunos[0]).toMatchObject({ nome: 'Fabi Moura', plano: null, matricula: null, pagamentos: [] });
  });

  it('forma em branco vira dinheiro; debito e credito sem acento; linhas sem nome sao ignoradas', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'GIL ALVES', set: pago('04/09/2026', '04/10/2026', '', ' R$ 90,00 ') },
      { nome: 'IVO MELO', set: pago('04/09/2026', '04/10/2026', 'Débito', ' R$ 90,00 ') },
      { nome: '   ' },
    ]));
    expect(r.alunos).toHaveLength(2);
    expect(r.alunos.map((a) => a.pagamentos[0].forma)).toEqual(['dinheiro', 'debito']);
  });

  it('ano digitado errado (2016, 1993) vira o ano da planilha', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'JOAO REIS', set: pago('04/09/2016', '04/10/2016', 'Pix', ' R$ 90,00 ') },
      { nome: 'LIA NUNES', set: pago('08/09/1993', '08/10/1993', 'Pix', ' R$ 90,00 ') },
      { nome: 'MAX PRADO', set: pago('05/09/2026', '05/10/2026', 'Pix', ' R$ 90,00 ') },
      { nome: 'NINA LIMA', set: pago('06/09/2026', '06/10/2026', 'Pix', ' R$ 90,00 ') },
    ]));
    expect(r.alunos[0].matricula).toEqual({ dataInicio: '2026-09-04', dataFim: '2026-10-04' });
    expect(r.alunos[1].pagamentos[0].data).toBe('2026-09-08');
  });

  it('avisa quando um "Pago" nao tem data nem vencimento (nada e descartado em silencio)', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'SILVIA ROCHA', set: { situacao: 'Pago', valor: ' R$ 90,00 ' } },
      { nome: 'TINA BORGES', set: pago('02/09/2026', '02/10/2026', 'Pix', ' R$ 90,00 ') },
    ]));
    expect(r.avisos.join(' ')).toMatch(/Silvia Rocha.*sem data/i);
    expect(r.alunos[0]).toMatchObject({ matricula: null, pagamentos: [] });
  });

  it('avisa quando o valor esta num formato que nao da para ler', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'URSULA DIAS', set: pago('02/09/2026', '02/10/2026', 'Pix', 'noventa reais') },
    ]));
    expect(r.avisos.join(' ')).toMatch(/Ursula Dias.*valor/i);
  });

  it('data que nao existe no calendario nao vira matricula', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'VERA LUZ', set: pago('31/09/2026', '31/09/2026', 'Pix', ' R$ 90,00 ') },
    ]));
    expect(r.alunos[0].matricula).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/Vera Luz.*data/i);
  });

  it('ano fora do ano da planilha e corrigido, menos a virada de dezembro para janeiro', () => {
    const r = converterPlanilhaMensalidades(planilha([
      { nome: 'ANO ERRADO', set: pago('01/09/2025', '01/10/2025', 'Pix', ' R$ 90,00 ') },
      { nome: 'VIRADA ANO', set: pago('20/12/2025', '05/01/2027', 'Pix', ' R$ 90,00 ') },
      { nome: 'NORMAL UM', set: pago('02/09/2026', '02/10/2026', 'Pix', ' R$ 90,00 ') },
      { nome: 'NORMAL DOIS', set: pago('03/09/2026', '03/10/2026', 'Pix', ' R$ 90,00 ') },
    ]));
    expect(r.alunos[0].matricula).toEqual({ dataInicio: '2026-09-01', dataFim: '2026-10-01' });
    expect(r.alunos[1].matricula).toEqual({ dataInicio: '2025-12-20', dataFim: '2027-01-05' });
  });

  it('marca o formato do arquivo', () => {
    const r = converterPlanilhaMensalidades(planilha([{ nome: 'HUGO NUNES' }]));
    expect(r).toMatchObject({ formato: 'darkfisic-importacao', versao: 1 });
  });

  it('recusa arquivo que nao e a planilha de mensalidades', () => {
    expect(() => converterPlanilhaMensalidades('nome;idade\nAna;30')).toThrow('não reconhecida');
  });
});
