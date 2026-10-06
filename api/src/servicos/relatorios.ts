import { eq, and, gte, lt } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { pagamento, matricula, plano, academia } from '../db/schema.js';
import { formatarBRL } from '../dominio/dinheiro.js';
import { hoje } from '../dominio/datas.js';

type Db = BetterSQLite3Database<any>;
type Mes = string;  // 'AAAA-MM'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ROTULO_FORMA: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', boleto: 'Boleto',
};

function proximoMes(mes: Mes): Mes {
  const [ano, m] = mes.split('-').map(Number);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`;
}
function mesAnterior(mes: Mes): Mes {
  const [ano, m] = mes.split('-').map(Number);
  return m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, '0')}`;
}
const porExtenso = (mes: Mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

/**
 * Numeros do financeiro ao longo do tempo: o que o dono olha para decidir.
 * Tudo sai daqui pronto para virar grafico ou mensagem -- a tela nao faz conta.
 */
export function criarServicoRelatorios(db: Db) {
  function pagamentosDoMes(mes: Mes) {
    return db.select({ valor: pagamento.valorCentavos, forma: pagamento.forma, data: pagamento.dataPagamento })
      .from(pagamento)
      .where(and(gte(pagamento.dataPagamento, `${mes}-01`), lt(pagamento.dataPagamento, `${proximoMes(mes)}-01`)))
      .all();
  }

  /** Serie dos ultimos `meses` meses terminando em `ate` -- mes sem pagamento entra com zero. */
  function receitaPorMes(ate: Mes = hoje().slice(0, 7), meses = 6) {
    const serie: Array<{ mes: Mes; totalCentavos: number; pagamentos: number }> = [];
    let m = ate;
    for (let i = 0; i < meses; i++) { serie.unshift({ mes: m, totalCentavos: 0, pagamentos: 0 }); m = mesAnterior(m); }
    for (const item of serie) {
      const pgs = pagamentosDoMes(item.mes);
      item.totalCentavos = pgs.reduce((s, p) => s + p.valor, 0);
      item.pagamentos = pgs.length;
    }
    return serie;
  }

  function formasDoMes(mes: Mes = hoje().slice(0, 7)) {
    const soma = new Map<string, { totalCentavos: number; quantidade: number }>();
    for (const p of pagamentosDoMes(mes)) {
      const atual = soma.get(p.forma) ?? { totalCentavos: 0, quantidade: 0 };
      soma.set(p.forma, { totalCentavos: atual.totalCentavos + p.valor, quantidade: atual.quantidade + 1 });
    }
    return [...soma.entries()]
      .map(([forma, v]) => ({ forma, ...v }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos);
  }

  /** Quantos alunos em cada plano hoje (matricula ativa). */
  function alunosPorPlano() {
    const linhas = db.select({ nome: plano.nome }).from(matricula)
      .innerJoin(plano, eq(plano.id, matricula.planoId))
      .where(eq(matricula.status, 'ativa')).all();
    const soma = new Map<string, number>();
    for (const l of linhas) soma.set(l.nome, (soma.get(l.nome) ?? 0) + 1);
    return [...soma.entries()].map(([p, alunos]) => ({ plano: p, alunos }))
      .sort((a, b) => b.alunos - a.alunos || a.plano.localeCompare(b.plano));
  }

  function doMes(mes: Mes = hoje().slice(0, 7)) {
    const pgs = pagamentosDoMes(mes);
    const receitaCentavos = pgs.reduce((s, p) => s + p.valor, 0);
    const anterior = pagamentosDoMes(mesAnterior(mes)).reduce((s, p) => s + p.valor, 0);
    return {
      mes,
      mesPorExtenso: porExtenso(mes),
      academia: db.select({ nome: academia.nome }).from(academia).limit(1).get()?.nome ?? 'Academia',
      receitaCentavos,
      pagamentos: pgs.length,
      ticketMedioCentavos: pgs.length ? Math.round(receitaCentavos / pgs.length) : 0,
      mesAnteriorCentavos: anterior,
      // sem mes anterior nao da para falar em variacao: null, nao 0 nem 100%
      variacaoPct: anterior ? Math.round(((receitaCentavos - anterior) / anterior) * 100) : null,
      formas: formasDoMes(mes),
      porPlano: alunosPorPlano(),
      serie: receitaPorMes(mes, 6),
    };
  }

  /** Resumo curto para mandar no WhatsApp do dono. */
  function textoDoMes(mes: Mes = hoje().slice(0, 7)): string {
    const r = doMes(mes);
    const variacao = r.variacaoPct === null ? ''
      : `\n${r.variacaoPct >= 0 ? '▲' : '▼'} ${Math.abs(r.variacaoPct)}% em relação a ${porExtenso(mesAnterior(mes))} (${formatarBRL(r.mesAnteriorCentavos)})`;
    const formas = r.formas.length
      ? '\n\nComo entrou:\n' + r.formas.map((f) => `• ${ROTULO_FORMA[f.forma] ?? f.forma}: ${formatarBRL(f.totalCentavos)} (${f.quantidade})`).join('\n')
      : '';
    const planos = r.porPlano.length
      ? '\n\nAlunos por plano:\n' + r.porPlano.slice(0, 6).map((p) => `• ${p.plano}: ${p.alunos}`).join('\n')
      : '';
    return `*${r.academia}* — ${porExtenso(mes)}\n\n`
      + `Recebido: ${formatarBRL(r.receitaCentavos)}\n`
      + `Pagamentos: ${r.pagamentos}\n`
      + `Ticket médio: ${formatarBRL(r.ticketMedioCentavos)}${variacao}${formas}${planos}`;
  }

  return { receitaPorMes, formasDoMes, alunosPorPlano, doMes, textoDoMes };
}
