import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { aluno, academia } from '../db/schema.js';
import { hoje, diffDias, type DataISO } from '../dominio/datas.js';
import { criarServicoAlunos } from './alunos.js';
import { criarServicoCheckins } from './checkins.js';
import { criarServicoFinanceiro } from './financeiro.js';
import { criarServicoAulas } from './aulas.js';

type Db = BetterSQLite3Database<any>;

export function criarServicoDashboard(db: Db) {
  const alunos = criarServicoAlunos(db);
  const checkins = criarServicoCheckins(db);
  const fin = criarServicoFinanceiro(db);
  const aulas = criarServicoAulas(db);

  function resumo(hojeISO: DataISO = hoje()) {
    const cfg = db.select().from(academia).limit(1).get();
    const diasSumido = cfg?.diasAlunoSumido ?? 10;
    const todos = alunos.listar({}, hojeISO);
    const aulasHoje = aulas.doDia(hojeISO);
    const vagas = aulasHoje.reduce((s, a) => s + a.vagas, 0);
    const ocupadas = aulasHoje.reduce((s, a) => s + a.inscritos, 0);

    return {
      academia: cfg?.nome ?? 'Academia',
      ativos: todos.filter((a) => a.status === 'ativo').length,
      vencendo: todos.filter((a) => a.status === 'vencendo').length,
      vencidos: todos.filter((a) => a.status === 'vencido').length,
      inativos: todos.filter((a) => a.status === 'inativo').length,
      checkinsHoje: checkins.doDia(hojeISO).length,
      receitaMesCentavos: fin.receitaDoMes(hojeISO.slice(0, 7)),
      recebidoHojeCentavos: fin.recebidoEm(hojeISO),
      inadimplenciaCentavos: fin.inadimplencia(hojeISO),
      aulasHoje: aulasHoje.length,
      ocupacaoPct: vagas ? Math.round((ocupadas / vagas) * 100) : 0,
      aVencer: todos.filter((a) => a.status === 'vencendo')
        .sort((x, y) => (x.diasParaVencer ?? 0) - (y.diasParaVencer ?? 0)),
      // plano valido mas sem aparecer: e quem cancela no mes seguinte
      sumidos: todos.filter((a) =>
        (a.status === 'ativo' || a.status === 'vencendo') &&
        (!a.ultimoCheckin || diffDias(a.ultimoCheckin, hojeISO) >= diasSumido)),
      checkinsRecentes: checkins.recentes(8).map((c) => {
        const a = db.select({ nome: aluno.nome }).from(aluno).where(eq(aluno.id, c.alunoId)).get();
        return { ...c, alunoNome: a?.nome ?? '—', alunoStatus: todos.find((x) => x.id === c.alunoId)?.status ?? 'inativo' };
      }),
    };
  }

  return { resumo };
}
