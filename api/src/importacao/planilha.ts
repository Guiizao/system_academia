import { normalizarTelefone } from '../dominio/telefone.js';
import { adicionarMeses, type DataISO } from '../dominio/datas.js';
import type { ArquivoImportacao, AlunoImportado, FormaPagamento, PlanoImportado } from './formato.js';

/**
 * Converte a planilha "Controle de Mensalidades" (CSV exportado do Google
 * Planilhas, separado por ;) no arquivo de importacao do sistema.
 * As colunas sao achadas pelo NOME no cabecalho: na planilha real, setembro e
 * outubro trazem Valor e Forma em ordens diferentes.
 */

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const FORMAS: Record<string, FormaPagamento> = {
  pix: 'pix', dinheiro: 'dinheiro', credito: 'credito', debito: 'debito', boleto: 'boleto',
};

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function nomeProprio(bruto: string): string {
  return bruto.trim().split(/\s+/).filter(Boolean).map((parte, i) => {
    const m = parte.toLocaleLowerCase('pt-BR');
    if (i > 0 && PARTICULAS.has(m)) return m;
    return m.charAt(0).toLocaleUpperCase('pt-BR') + m.slice(1);
  }).join(' ');
}

/** Celular/fixo da planilha em E.164. Sem DDD, usa o DDD da academia; invalido vira null. */
export function telefoneDaPlanilha(bruto: string, dddPadrao: string | null): string | null {
  let d = (bruto ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if ((d.length === 8 || d.length === 9) && dddPadrao) d = dddPadrao + d;
  try { return normalizarTelefone(d); } catch { return null; }
}

// so o formato da planilha: 90 | 90,00 | 1.188,50. "90.00", "1e3" e "0x10"
// nao sao valores em reais -- chutar ali viraria mensalidade de R$ 9.000.
const RE_VALOR = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/;

export function valorEmCentavos(bruto: string): number | null {
  const limpo = (bruto ?? '').replace(/R\$/i, '').replace(/\s/g, '');
  if (!limpo) return null;
  if (!RE_VALOR.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const RE_DATA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * dd/mm/aaaa -> ISO, conferindo o calendario (31/09 nao existe).
 * Ano diferente do ano da planilha e erro de digitacao (2016, 1993, 2025):
 * vira o da planilha. A excecao e a virada do ano -- vencimento em janeiro do
 * ano seguinte e pagamento em dezembro do anterior sao legitimos.
 */
function dataDaPlanilha(bruto: string, anoDaPlanilha: number | null): DataISO | null {
  const m = (bruto ?? '').trim().match(RE_DATA);
  if (!m) return null;
  const [dia, mes, digitado] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12) return null;
  const viradaDeAno = (mes === 1 && digitado === (anoDaPlanilha ?? 0) + 1)
    || (mes === 12 && digitado === (anoDaPlanilha ?? 0) - 1);
  const ano = anoDaPlanilha && !viradaDeAno ? anoDaPlanilha : digitado;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** O ano que mais aparece nas datas da planilha. */
function anoMaisComum(linhas: string[][]): number | null {
  const cont = new Map<number, number>();
  for (const c of linhas.flat()) {
    const m = c.trim().match(RE_DATA);
    if (m) cont.set(Number(m[3]), (cont.get(Number(m[3])) ?? 0) + 1);
  }
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** CSV com aspas, ; e quebras CRLF. */
function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const linhas: string[][] = [];
  let linha: string[] = [], campo = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c !== '"') campo += c;
      else if (t[i + 1] === '"') { campo += '"'; i++; }
      else aspas = false;
    } else if (c === '"') aspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

type Colunas = { situacao?: number; data?: number; vencimento?: number; forma?: number; valor?: number };

/** Para cada mes do cabecalho, onde fica cada campo dentro do bloco dele. */
function mapearMeses(h1: string[], h2: string[]): Colunas[] {
  const inicios = h1.map((c, i) => ({ mes: MESES.indexOf(semAcento(c)), i })).filter((x) => x.mes >= 0);
  return inicios.map(({ i }, k) => {
    const fim = k + 1 < inicios.length ? inicios[k + 1].i : h2.length;
    const col: Colunas = {};
    for (let j = i; j < fim; j++) {
      const nome = semAcento(h2[j] ?? '');
      if (nome === 'situacao') col.situacao = j;
      else if (nome.startsWith('data pg')) col.data = j;
      else if (nome.startsWith('prox')) col.vencimento = j;
      else if (nome.startsWith('forma')) col.forma = j;
      else if (nome === 'valor') col.valor = j;
    }
    return col;
  });
}

type Mes = {
  pago: boolean; data: DataISO | null; vencimento: DataISO | null;
  forma: FormaPagamento; valor: number | null; problemas: string[];
};

function lerMes(linha: string[], col: Colunas, ano: number | null): Mes {
  const v = (j?: number) => (j === undefined ? '' : linha[j] ?? '');
  const problemas: string[] = [];
  const data = (bruto: string, nome: string) => {
    const d = dataDaPlanilha(bruto, ano);
    if (!d && bruto.trim()) problemas.push(`a data "${bruto.trim()}" (${nome}) nao existe no calendario`);
    return d;
  };
  const valor = valorEmCentavos(v(col.valor));
  if (valor === null && v(col.valor).trim()) problemas.push(`o valor "${v(col.valor).trim()}" nao esta em reais`);
  const forma = semAcento(v(col.forma));
  if (forma && !FORMAS[forma]) problemas.push(`a forma de pagamento "${v(col.forma).trim()}" entrou como dinheiro`);
  return {
    pago: semAcento(v(col.situacao)).startsWith('pago'),
    data: data(v(col.data), 'pagamento'),
    vencimento: data(v(col.vencimento), 'vencimento'),
    forma: FORMAS[forma] ?? 'dinheiro',
    valor,
    problemas,
  };
}

const umMesAntes = (fim: DataISO) => adicionarMeses(fim, -1, Number(fim.slice(8, 10)));
const reais = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ','));

/** O valor mais comum e o "Mensal"; cada valor menor e um plano com desconto de personal. */
function montarPlanos(valores: number[]): { planos: PlanoImportado[]; nomeDe: (c: number) => string } {
  const contagem = new Map<number, number>();
  valores.forEach((v) => contagem.set(v, (contagem.get(v) ?? 0) + 1));
  const ordenados = [...contagem.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const padrao = ordenados[0]?.[0];
  const nomeDe = (c: number) => (c === padrao ? 'Mensal' : `Mensal com personal (R$ ${reais(c)})`);
  const precos = [...contagem.keys()].filter((c) => c !== padrao).sort((a, b) => b - a);
  const planos = (padrao === undefined ? [] : [padrao, ...precos])
    .map((c) => ({ nome: nomeDe(c), precoCentavos: c, duracaoMeses: 1 }));
  return { planos, nomeDe };
}

function dddMaisComum(telefones: string[]): string | null {
  const ddds = telefones.map((t) => t.replace(/\D/g, '')).filter((d) => d.length === 11).map((d) => d.slice(0, 2));
  const cont = new Map<string, number>();
  ddds.forEach((d) => cont.set(d, (cont.get(d) ?? 0) + 1));
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function converterPlanilhaMensalidades(csv: string, origem = 'planilha de mensalidades'): ArquivoImportacao & { avisos: string[] } {
  const avisos: string[] = [];
  const [h1 = [], h2 = [], ...corpo] = lerCsv(csv);
  const colWhats = h1.findIndex((c) => semAcento(c) === 'whatsapp');
  const meses = mapearMeses(h1, h2);
  if (semAcento(h1[0] ?? '') !== 'cliente' || meses.length === 0) {
    throw new Error('Planilha não reconhecida: esperava as colunas Cliente, WhatsApp e os meses');
  }

  const linhas = corpo.filter((l) => (l[0] ?? '').trim());
  const ddd = dddMaisComum(linhas.map((l) => l[colWhats] ?? ''));
  const ano = anoMaisComum(linhas);
  const lidas = linhas.map((l) => {
    const mesesDoAluno = meses.map((col) => lerMes(l, col, ano));
    const valorDoAluno = [...mesesDoAluno].reverse().find((m) => m.valor)?.valor ?? null;
    return { l, mesesDoAluno, valorDoAluno };
  });
  const { planos, nomeDe } = montarPlanos(lidas.map((x) => x.valorDoAluno).filter((v): v is number => v !== null));
  const padrao = planos[0]?.precoCentavos ?? null;

  const alunos: AlunoImportado[] = lidas.map(({ l, mesesDoAluno, valorDoAluno }) => {
    const nome = nomeProprio(l[0]);
    const avisar = (texto: string) => avisos.push(`${nome}: ${texto}`);
    mesesDoAluno.forEach((m) => m.problemas.forEach(avisar));
    const telefone = telefoneDaPlanilha(colWhats >= 0 ? l[colWhats] ?? '' : '', ddd);
    if (!telefone && (colWhats >= 0 ? l[colWhats] ?? '' : '').trim()) avisar('o telefone da planilha nao e um numero valido e ficou em branco');
    const ultimo = [...mesesDoAluno].reverse().find((m) => m.vencimento);
    const preco = valorDoAluno ?? padrao;
    // "Pago" sem data e sem vencimento nao vira pagamento: nao da para saber quando foi
    mesesDoAluno.filter((m) => m.pago && !m.data && !m.vencimento)
      .forEach(() => avisar('tem um mes marcado como Pago sem data nem vencimento. Registre esse pagamento a mao.'));
    const matricula = ultimo?.vencimento ? {
      dataInicio: ultimo.pago && ultimo.data && ultimo.data < ultimo.vencimento ? ultimo.data : umMesAntes(ultimo.vencimento),
      dataFim: ultimo.vencimento,
    } : null;
    const pagamentos = mesesDoAluno
      .filter((m) => m.pago && (m.data || m.vencimento) && (m.valor ?? preco))
      .map((m) => ({ data: m.data ?? umMesAntes(m.vencimento!), valorCentavos: (m.valor ?? preco)!, forma: m.forma }));
    return {
      nome,
      telefone,
      aceitaWhatsapp: telefone !== null,
      plano: matricula && preco ? nomeDe(preco) : null,
      matricula,
      pagamentos,
    };
  });

  return { formato: 'darkfisic-importacao', versao: 1, origem, geradoEm: new Date().toISOString(), planos, alunos, avisos };
}
