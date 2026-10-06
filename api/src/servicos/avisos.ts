import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { fichaTreino, aluno } from '../db/schema.js';
import { hoje, diffDias } from '../dominio/datas.js';
import { criarServicoDashboard } from './dashboard.js';
import { criarServicoFinanceiro } from './financeiro.js';

type Db = BetterSQLite3Database<any>;
type Papel = 'dono' | 'recepcao' | 'professor';

export interface Aviso {
  tipo: 'vencido' | 'vencendo' | 'sumido' | 'ficha' | 'cobranca';
  gravidade: 'alta' | 'media';
  titulo: string;
  detalhe: string;
  alunoId?: number;
}

/**
 * O sino deixa de ser enfeite: lista o que precisa de acao hoje.
 * Cada papel ve o que lhe cabe -- professor nao recebe aviso de dinheiro.
 */
export function criarServicoAvisos(db: Db) {
  const dash = criarServicoDashboard(db);
  const fin = criarServicoFinanceiro(db);

  function paraPapel(papel: Papel, hojeISO = hoje()): Aviso[] {
    const avisos: Aviso[] = [];
    const r = dash.resumo(hojeISO);

    if (papel !== 'professor') {
      for (const c of fin.cobrancasAbertas()) {
        const dias = diffDias(hojeISO, c.vencimento);
        if (dias < 0) avisos.push({
          tipo: 'cobranca', gravidade: 'alta', alunoId: c.alunoId,
          titulo: c.alunoNome,
          detalhe: `Cobrança vencida há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`,
        });
      }
      for (const a of r.aVencer) avisos.push({
        tipo: 'vencendo', gravidade: 'media', alunoId: a.id,
        titulo: a.nome,
        detalhe: a.diasParaVencer === 0 ? 'Plano vence hoje' : a.diasParaVencer === 1 ? 'Plano vence amanhã' : `Plano vence em ${a.diasParaVencer} dias`,
      });
    }
    for (const a of r.sumidos) avisos.push({
      tipo: 'sumido', gravidade: 'media', alunoId: a.id,
      titulo: a.nome,
      detalhe: a.ultimoCheckin ? `Sumido: último check-in há ${diffDias(a.ultimoCheckin, hojeISO)} dias` : 'Sumido: nunca fez check-in',
    });
    {
      // todo mundo libera ficha, entao todo mundo e avisado do que esta parado
      const rascunhos = db.select({ id: fichaTreino.id, alunoId: fichaTreino.alunoId, nome: aluno.nome })
        .from(fichaTreino).innerJoin(aluno, eq(aluno.id, fichaTreino.alunoId))
        .where(eq(fichaTreino.status, 'rascunho')).all();
      for (const f of rascunhos) avisos.push({
        tipo: 'ficha', gravidade: 'media', alunoId: f.alunoId,
        titulo: f.nome,
        detalhe: 'Ficha em rascunho, o aluno ainda não recebeu',
      });
    }
    return avisos.sort((x, y) => (x.gravidade === y.gravidade ? 0 : x.gravidade === 'alta' ? -1 : 1));
  }

  return { paraPapel };
}
