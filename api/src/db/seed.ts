import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as t from './schema.js';
import { hashSenha } from '../servicos/auth.js';
import { adicionarMeses, hoje, dataLocalDe, type DataISO } from '../dominio/datas.js';
import {
  NOMES, SOBRENOMES, RESTRICOES_POSSIVEIS, TAGS_RESTRICAO, PLANOS, EXERCICIOS, AULAS, ATIVIDADES,
} from './seed-dados.js';

type Db = BetterSQLite3Database<any>;

/** Gerador com semente fixa: mesma semente, mesmos dados. */
function gerador(semente: number) {
  let s = semente >>> 0;
  const r = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    int: (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min,
    de: <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)],
    chance: (p: number) => r() < p,
  };
}

function somarDias(d: DataISO, n: number): DataISO {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia + n)).toISOString().slice(0, 10);
}

/** Tabelas em ordem segura para apagar (filhas antes das maes). */
const ORDEM_LIMPEZA = [
  t.fichaItem, t.fichaDivisao, t.fichaTreino, t.inscricaoAula, t.aula, t.checkin,
  t.pagamento, t.cobranca, t.matricula, t.avaliacaoFisica, t.sessao, t.logAuditoria,
  t.mensagemSaida, t.exercicio, t.aluno, t.plano, t.tagRestricao, t.usuario,
  t.horarioFuncionamento, t.academia,
];

export const SENHA_DEMO = 'darkfisic123';

export async function semear(db: Db, opts: { hojeISO?: DataISO; semente?: number } = {}) {
  const H = opts.hojeISO ?? hoje();
  const g = gerador(opts.semente ?? 42);

  for (const tabela of ORDEM_LIMPEZA) db.delete(tabela).run();

  db.insert(t.academia).values({
    nome: 'DARK FISIC', responsavel: 'João', telefone: '+551133334444',
    whatsapp: '+5511999998888', instagram: '@darkfisic',
    pixChave: 'darkfisic@email.com', pixTipo: 'email',
    pixNomeRecebedor: 'DARK FISIC ACADEMIA', pixCidade: 'SAO PAULO',
  }).run();

  for (let d = 0; d < 7; d++) {
    db.insert(t.horarioFuncionamento).values({
      diaSemana: d, aberto: d !== 0,
      abre: d === 6 ? '08:00' : '06:00', fecha: d === 6 ? '18:00' : '22:00',
    }).run();
  }

  // Equipe: o dono NAO tem CREF -- de proposito, para exercitar o portao.
  const senha = await hashSenha(SENHA_DEMO);
  const equipe = [
    { nome: 'João', email: 'joao@darkfisic.com', papel: 'dono' as const },
    { nome: 'Pedro Lima', email: 'pedro@darkfisic.com', papel: 'professor' as const, cref: '123456-G/SP', especialidade: 'Musculação' },
    { nome: 'Ana Martins', email: 'ana@darkfisic.com', papel: 'professor' as const, cref: '234567-G/SP', especialidade: 'Funcional' },
    { nome: 'Bruna Reis', email: 'bruna@darkfisic.com', papel: 'recepcao' as const },
  ].map((u) => db.insert(t.usuario).values({ ...u, senhaHash: senha }).returning().get());

  for (const [codigo, rotulo] of TAGS_RESTRICAO) db.insert(t.tagRestricao).values({ codigo, rotulo }).run();
  const planos = PLANOS.map((p) => db.insert(t.plano).values(p).returning().get());
  const exercicios = EXERCICIOS.map(([nome, grupo, padrao, equip, nivel, contra]) =>
    db.insert(t.exercicio).values({
      nome, grupoMuscular: grupo, padraoMovimento: padrao, equipamento: equip,
      nivelMinimo: nivel, contraindicacoes: contra,
    }).returning().get());

  const contadores = { alunos: 0, matriculas: 0, pagamentos: 0, cobrancas: 0, checkins: 0, avaliacoes: 0, inscricoes: 0, fichas: 0 };
  const usados = new Set<string>();
  const alunos: Array<{ id: number; ativoNaAcademia: boolean }> = [];

  for (let i = 0; i < 40; i++) {
    let nome = '';
    do { nome = `${g.de(NOMES)} ${g.de(SOBRENOMES)}`; } while (usados.has(nome));
    usados.add(nome);

    const restr = g.chance(0.22) ? g.de(RESTRICOES_POSSIVEIS) : null;
    const a = db.insert(t.aluno).values({
      nome,
      telefone: `+55119${String(80000000 + i * 1111).padStart(8, '0')}`,
      email: `${nome.toLowerCase().replace(/ /g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@email.com`,
      cpf: `${String(100 + i).padStart(3, '0')}.${g.int(100, 999)}.${g.int(100, 999)}-${String(i % 100).padStart(2, '0')}`,
      sexo: g.chance(0.5) ? 'Masculino' : 'Feminino',
      dataNascimento: `${g.int(1975, 2005)}-${String(g.int(1, 12)).padStart(2, '0')}-${String(g.int(1, 28)).padStart(2, '0')}`,
      restricoes: restr?.tags ?? [], observacoesMedicas: restr?.obs ?? null,
      aceitaWhatsapp: g.chance(0.85), consentimentoLgpdEm: new Date().toISOString(),
    }).returning().get();
    contadores.alunos++;

    // cenario -> data de vencimento desejada da matricula vigente
    const sorteio = g.r();
    const cenario = sorteio < 0.62 ? 'ativo' : sorteio < 0.74 ? 'vencendo' : sorteio < 0.88 ? 'vencido' : 'inativo';
    const plano = g.chance(0.55) ? planos[1] : g.chance(0.5) ? planos[0] : g.chance(0.6) ? planos[2] : planos[3];

    let fimVigente: DataISO | null = null;
    if (cenario === 'ativo') fimVigente = somarDias(H, g.int(6, plano.duracaoMeses * 28));
    if (cenario === 'vencendo') fimVigente = somarDias(H, g.int(0, 5));
    if (cenario === 'vencido') fimVigente = somarDias(H, -g.int(1, 25));
    if (cenario === 'inativo') fimVigente = somarDias(H, -g.int(40, 120)); // saiu ha tempo

    semearHistorico(db, g, { alunoId: a.id, plano, fimVigente: fimVigente!, cenario, H, contadores });
    alunos.push({ id: a.id, ativoNaAcademia: cenario !== 'inativo' });
    semearCheckins(db, g, { alunoId: a.id, cenario, H, contadores });
    semearAvaliacoes(db, g, { alunoId: a.id, avaliador: equipe[1].id, H, contadores });
  }

  semearAulas(db, g, { equipe, alunos, H, contadores });
  semearFichas(db, g, { equipe, alunos, exercicios, H, contadores });

  return { contadores, equipe: equipe.map((u) => ({ nome: u.nome, email: u.email, papel: u.papel, cref: u.cref })) };
}

type G = ReturnType<typeof gerador>;
type Plano = typeof t.plano.$inferSelect;
type Cont = Record<string, number>;

/**
 * Historico de matriculas de tras para frente a partir do vencimento vigente:
 * cada periodo anterior termina onde o seguinte comeca. Um pagamento por periodo.
 */
function semearHistorico(db: Db, g: G, a: {
  alunoId: number; plano: Plano; fimVigente: DataISO; cenario: string; H: DataISO; contadores: Cont;
}) {
  const ancora = Number(a.fimVigente.slice(8, 10));
  const nPeriodos = a.plano.duracaoMeses >= 12 ? 1 : g.int(1, Math.max(1, Math.floor(8 / a.plano.duracaoMeses)));
  const periodos: Array<{ inicio: DataISO; fim: DataISO }> = [];
  let fim = a.fimVigente;
  for (let k = 0; k < nPeriodos; k++) {
    const inicio = adicionarMeses(fim, -a.plano.duracaoMeses, ancora);
    periodos.unshift({ inicio, fim });
    fim = inicio;
  }

  periodos.forEach((p, idx) => {
    const vigente = idx === periodos.length - 1;
    const m = db.insert(t.matricula).values({
      alunoId: a.alunoId, planoId: a.plano.id, dataInicio: p.inicio, dataFim: p.fim,
      diaAncora: ancora, valorCentavos: a.plano.precoCentavos,
      // inativo: a ultima tambem foi encerrada -- ninguem renovou
      status: vigente && a.cenario !== 'inativo' ? 'ativa' : 'encerrada',
    }).returning().get();
    a.contadores.matriculas++;

    // paga no inicio do periodo, as vezes uns dias antes
    const dataPg = somarDias(p.inicio, -g.int(0, 3));
    if (dataPg <= a.H) {
      db.insert(t.pagamento).values({
        alunoId: a.alunoId, valorCentavos: a.plano.precoCentavos,
        forma: g.de(['pix', 'pix', 'pix', 'dinheiro', 'debito', 'credito'] as const),
        dataPagamento: dataPg, observacao: a.plano.nome,
      }).run();
      a.contadores.pagamentos++;
    }

    // renovacao em aberto: quem esta vencendo ou vencido deve o proximo periodo
    if (vigente && (a.cenario === 'vencendo' || a.cenario === 'vencido')) {
      db.insert(t.cobranca).values({
        matriculaId: m.id, alunoId: a.alunoId, competencia: p.fim.slice(0, 7),
        valorCentavos: a.plano.precoCentavos, vencimento: p.fim,
      }).run();
      a.contadores.cobrancas++;
    }
  });
}

function semearCheckins(db: Db, g: G, a: { alunoId: number; cenario: string; H: DataISO; contadores: Cont }) {
  if (a.cenario === 'inativo') return;
  const porSemana = g.int(1, 5);
  // ~15% dos que pagam somem: o alerta de "aluno sumido" precisa ter o que mostrar
  const sumido = a.cenario !== 'vencido' && g.chance(0.15);
  const ultimoDia = sumido ? g.int(12, 20) : 0;

  for (let d = 45; d >= ultimoDia; d--) {
    if (!g.chance(porSemana / 7)) continue;
    // horario 6h-21h59 de SP; parte depois das 21h exercita a correcao de fuso
    const hora = g.chance(0.12) ? 21 : g.int(6, 20);
    const dia = somarDias(a.H, -d);
    const instante = new Date(`${dia}T${String(hora).padStart(2, '0')}:${String(g.int(0, 59)).padStart(2, '0')}:00-03:00`);
    if (instante.getTime() > Date.now()) continue;
    db.insert(t.checkin).values({
      alunoId: a.alunoId, atividade: g.de(ATIVIDADES), origem: 'manual',
      dataHora: instante.toISOString(), dataLocal: dataLocalDe(instante),
    }).run();
    a.contadores.checkins++;
  }
}

function semearAvaliacoes(db: Db, g: G, a: { alunoId: number; avaliador: number; H: DataISO; contadores: Cont }) {
  if (!g.chance(0.75)) return;
  const altura = Number((g.int(155, 190) / 100).toFixed(2));
  let peso = g.int(55, 98);
  let gordura = g.int(14, 30);
  let cintura = g.int(64, 98);
  const objetivo = g.de(['hipertrofia', 'emagrecimento', 'definicao', 'condicionamento', 'saude_geral'] as const);
  const nivel = g.de(['iniciante', 'iniciante', 'intermediario', 'avancado'] as const);
  const n = g.int(1, 3);
  for (let k = n - 1; k >= 0; k--) {
    db.insert(t.avaliacaoFisica).values({
      alunoId: a.alunoId, data: somarDias(a.H, -(k * 60 + g.int(3, 20))),
      pesoKg: peso, alturaM: altura, percGordura: gordura,
      circBraco: g.int(24, 40), circPeito: g.int(80, 108), circCintura: cintura,
      circQuadril: g.int(86, 104), circCoxa: g.int(48, 64), circOmbros: g.int(36, 50),
      objetivo, nivel, avaliadorUsuarioId: a.avaliador,
    }).run();
    a.contadores.avaliacoes++;
    // evolucao entre avaliacoes: quem treina melhora um pouco
    if (objetivo === 'emagrecimento') { peso -= g.int(1, 3); cintura -= g.int(1, 3); }
    else { peso += g.int(0, 2); }
    gordura = Math.max(10, gordura - g.int(0, 2));
  }
}

function semearAulas(db: Db, g: G, a: {
  equipe: Array<{ id: number }>; alunos: Array<{ id: number; ativoNaAcademia: boolean }>; H: DataISO; contadores: Cont;
}) {
  const aulas = AULAS.map(([nome, diaSemana, hora, duracaoMin, vagas, local, prof]) =>
    db.insert(t.aula).values({
      nome, diaSemana, hora, duracaoMin, vagas, local, professorUsuarioId: a.equipe[prof].id,
    }).returning().get());

  const ativos = a.alunos.filter((x) => x.ativoNaAcademia);
  // inscricoes para hoje e os proximos 6 dias
  for (let d = 0; d < 7; d++) {
    const data = somarDias(a.H, d);
    const [ano, mes, dia] = data.split('-').map(Number);
    const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    for (const aula of aulas.filter((x) => x.diaSemana === dow)) {
      const alvo = Math.min(aula.vagas, Math.round(aula.vagas * (0.4 + g.r() * 0.6)));
      const embaralhados = [...ativos].sort(() => g.r() - 0.5).slice(0, alvo);
      for (const al of embaralhados) {
        db.insert(t.inscricaoAula).values({ aulaId: aula.id, alunoId: al.id, data }).run();
        a.contadores.inscricoes++;
      }
    }
  }
}

function semearFichas(db: Db, g: G, a: {
  equipe: Array<{ id: number; cref: string | null }>; alunos: Array<{ id: number; ativoNaAcademia: boolean }>;
  exercicios: Array<typeof t.exercicio.$inferSelect>; H: DataISO; contadores: Cont;
}) {
  const professores = a.equipe.filter((u) => u.cref);
  const porPadrao = (p: string) => a.exercicios.filter((e) => e.padraoMovimento === p);
  const alvo = a.alunos.filter((x) => x.ativoNaAcademia).slice(0, 14);

  alvo.forEach((al, idx) => {
    const aluno = db.select().from(t.aluno).all().find((x) => x.id === al.id)!;
    // respeita a restricao: tira da selecao o que for contraindicado
    const permitido = (e: typeof t.exercicio.$inferSelect) =>
      !e.contraindicacoes.some((c) => aluno.restricoes.includes(c));
    const pega = (padrao: string) => porPadrao(padrao).filter(permitido)[0];

    const divisoes = [
      { rotulo: 'A', foco: 'Empurrar + pernas', itens: [pega('empurrar_horizontal'), pega('agachar'), pega('isolado')] },
      { rotulo: 'B', foco: 'Puxar + posterior', itens: [pega('puxar_vertical'), pega('puxar_horizontal'), pega('dobradica_quadril')] },
    ].map((d) => ({ ...d, itens: d.itens.filter(Boolean) }));

    const prof = professores[idx % professores.length];
    const aprovada = idx % 3 !== 0; // 1 em cada 3 fica em rascunho, esperando o CREF
    const f = db.insert(t.fichaTreino).values({
      alunoId: al.id, objetivo: 'hipertrofia', nivel: 'intermediario', diasPorSemana: 4,
      status: aprovada ? 'aprovada' : 'rascunho', geradaPor: 'manual', criadoPorUsuarioId: prof.id,
      ...(aprovada ? {
        aprovadaPorUsuarioId: prof.id, aprovadaCref: prof.cref,
        aprovadaEm: new Date(`${somarDias(a.H, -g.int(1, 30))}T10:00:00-03:00`).toISOString(),
      } : {}),
    }).returning().get();
    a.contadores.fichas++;

    divisoes.forEach((d, i) => {
      const div = db.insert(t.fichaDivisao).values({ fichaId: f.id, rotulo: d.rotulo, foco: d.foco, ordem: i + 1 }).returning().get();
      d.itens.forEach((e, j) => db.insert(t.fichaItem).values({
        divisaoId: div.id, exercicioId: e!.id, ordem: j + 1,
        series: g.int(3, 4), reps: g.de(['8-10', '10-12', '12-15']), descansoSeg: g.de([45, 60, 75, 90]),
      }).run());
    });
  });
}
