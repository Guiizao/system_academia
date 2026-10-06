import type Database from 'better-sqlite3';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PADRAO = /^darkfisic-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.db$/;
/**
 * Copia feita antes de "Comecar do zero": fora do padrao da rotacao, entao a
 * retencao nunca apaga -- um backup mais tarde no mesmo dia substituiria o
 * unico registro dos dados apagados. Quem remove e a pessoa, pela pasta.
 */
// o mesmo vale para as copias feitas antes de importar alunos e antes de atualizar o programa
const PADRAO_RESET = /^antes-d[ao]-(reset|importacao|atualizacao)-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;

function carimbo(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/**
 * Copia consistente do banco EM USO. VACUUM INTO, nunca copiar o arquivo:
 * copiar durante uma escrita gera backup corrompido que so se descobre
 * na hora de restaurar.
 */
export function fazerBackup(sqlite: Database.Database, pasta: string, agora = new Date(), prefixo = 'darkfisic'): string {
  mkdirSync(pasta, { recursive: true });
  const destino = join(pasta, `${prefixo}-${carimbo(agora)}.db`);
  sqlite.prepare('VACUUM INTO ?').run(destino);
  return destino;
}

/** Semana ISO (ano-semana) de uma data -- chave da retencao semanal. */
function semanaIso(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7)}`;
}

/**
 * Quais backups manter: o mais recente de cada um dos ultimos 7 dias,
 * de cada uma das ultimas 4 semanas e de cada um dos ultimos 12 meses.
 * Guardar so o ultimo replicaria fielmente um ransomware para o backup.
 */
export function selecionarRetencao(arquivos: string[], agora = new Date()): { manter: string[]; apagar: string[] } {
  const datados = arquivos
    .map((nome) => {
      const m = nome.match(PADRAO);
      return m ? { nome, data: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) } : null;
    })
    .filter((x): x is { nome: string; data: Date } => !!x)
    .sort((a, b) => b.data.getTime() - a.data.getTime()); // mais recente primeiro

  const manter = new Set<string>();
  const regras: Array<{ chave: (d: Date) => string; limite: number }> = [
    { chave: (d) => d.toDateString(), limite: 7 },
    { chave: semanaIso, limite: 4 },
    { chave: (d) => `${d.getFullYear()}-${d.getMonth()}`, limite: 12 },
  ];
  for (const regra of regras) {
    const vistos = new Set<string>();
    for (const b of datados) {
      const k = regra.chave(b.data);
      if (vistos.has(k)) continue;
      if (vistos.size >= regra.limite) break;
      vistos.add(k);
      manter.add(b.nome);
    }
  }
  return {
    manter: datados.filter((b) => manter.has(b.nome)).map((b) => b.nome),
    apagar: datados.filter((b) => !manter.has(b.nome)).map((b) => b.nome),
  };
}

export function aplicarRetencao(pasta: string, agora = new Date()): string[] {
  const { apagar } = selecionarRetencao(readdirSync(pasta), agora);
  for (const nome of apagar) rmSync(join(pasta, nome));
  return apagar;
}

export function listarBackups(pasta: string) {
  try {
    const data = (n: string) => n.slice(n.length - 22);  // ordena pela data, qualquer que seja o prefixo
    return readdirSync(pasta).filter((n) => PADRAO.test(n) || PADRAO_RESET.test(n))
      .sort((a, b) => data(b).localeCompare(data(a)))
      .map((nome) => ({ nome, bytes: statSync(join(pasta, nome)).size }));
  } catch { return []; }
}
