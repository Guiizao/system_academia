import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { aluno, plano, matricula, pagamento } from '../db/schema.js';
import { esquemaImportacao, type ArquivoImportacao } from '../importacao/formato.js';
import { precisaConfigurar } from './primeiro-acesso.js';

type Db = BetterSQLite3Database<any>;
const OBSERVACAO = 'Importado da planilha';
const LIMITE_ARQUIVO = 20 * 1024 * 1024;

export type ResumoImportacao = {
  alunosCriados: number; planosCriados: number; matriculas: number; pagamentos: number; ignorados: string[];
};
export type ResultadoArquivo = {
  arquivo: string; situacao: 'importado' | 'aguardando' | 'erro';
  resumo?: ResumoImportacao; motivo?: string; backup?: string;
};

/** "ÁNA  lima" e "Ana Lima" sao a mesma pessoa para nao duplicar cadastro. */
const chaveNome = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function conferirPlanos(arq: ArquivoImportacao) {
  const nomes = new Set(arq.planos.map((p) => p.nome));
  const semPlano = arq.alunos.find((a) => a.matricula && (!a.plano || !nomes.has(a.plano)));
  if (semPlano) throw new Error(`Aluno ${semPlano.nome}: o plano "${semPlano.plano}" não está na lista de planos do arquivo`);
}

/** Planos do arquivo -> id no banco, reaproveitando os que ja existem (mesmo nome, preco e duracao). */
function garantirPlanos(tx: Db, arq: ArquivoImportacao) {
  const atuais = tx.select().from(plano).all();
  let criados = 0;
  const ids = new Map<string, { id: number; preco: number }>();
  for (const p of arq.planos) {
    const igual = atuais.find((x) => chaveNome(x.nome) === chaveNome(p.nome)
      && x.precoCentavos === p.precoCentavos && x.duracaoMeses === p.duracaoMeses);
    const id = igual?.id ?? tx.insert(plano).values(p).returning({ id: plano.id }).get().id;
    if (!igual) criados++;
    ids.set(p.nome, { id, preco: p.precoCentavos });
  }
  return { ids, criados };
}

/**
 * Grava o arquivo inteiro numa transacao: ou entra tudo, ou nada.
 * Quem ja esta cadastrado (mesmo nome ou mesmo telefone) e pulado -- importar
 * duas vezes nao duplica ninguem.
 */
export function importarAlunos(db: Db, entrada: unknown): ResumoImportacao {
  const arq = esquemaImportacao.parse(entrada);
  conferirPlanos(arq);
  return db.transaction((t) => {
    const tx = t as unknown as Db;
    const { ids, criados } = garantirPlanos(tx, arq);
    // So o nome decide quem ja existe. Pelo telefone, mae e filha que dividem o
    // numero viravam uma pessoa so -- some gente sem ninguem perceber.
    const nomes = new Set(tx.select({ nome: aluno.nome }).from(aluno).all().map((a) => chaveNome(a.nome)));
    const resumo: ResumoImportacao = { alunosCriados: 0, planosCriados: criados, matriculas: 0, pagamentos: 0, ignorados: [] };

    for (const a of arq.alunos) {
      if (nomes.has(chaveNome(a.nome))) {
        resumo.ignorados.push(a.nome);
        continue;
      }
      const { id } = tx.insert(aluno).values({
        nome: a.nome, telefone: a.telefone ?? '', aceitaWhatsapp: a.aceitaWhatsapp,
      }).returning({ id: aluno.id }).get();
      nomes.add(chaveNome(a.nome));
      resumo.alunosCriados++;

      if (a.matricula && a.plano) {
        const p = ids.get(a.plano)!;
        tx.insert(matricula).values({
          alunoId: id, planoId: p.id, dataInicio: a.matricula.dataInicio, dataFim: a.matricula.dataFim,
          diaAncora: Number(a.matricula.dataFim.slice(8, 10)), valorCentavos: p.preco,
          status: 'ativa', observacao: OBSERVACAO,
        }).run();
        resumo.matriculas++;
      }
      for (const pg of a.pagamentos) {
        tx.insert(pagamento).values({
          alunoId: id, valorCentavos: pg.valorCentavos, forma: pg.forma, dataPagamento: pg.data, observacao: OBSERVACAO,
        }).run();
        resumo.pagamentos++;
      }
    }
    return resumo;
  });
}

function motivoDoErro(e: unknown): string {
  if (e instanceof SyntaxError) return `Não é um JSON válido: ${e.message}`;
  if (e instanceof z.ZodError) {
    return 'Arquivo fora do formato: ' + e.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  }
  return e instanceof Error ? e.message : String(e);
}

/** Nome livre para renomear: nunca sobrescreve um .importado anterior. */
function destinoLivre(caminho: string): string {
  if (!existsSync(caminho)) return caminho;
  return `${caminho}-${Date.now()}`;
}

/** Renomeia sem deixar a falha estourar: arquivo preso pelo antivirus e comum. */
function renomear(caminho: string, sufixo: string): string | null {
  try { renameSync(caminho, destinoLivre(`${caminho}.${sufixo}`)); return null; }
  catch (e) { return motivoDoErro(e); }
}

function importarUm(db: Db, pasta: string, arquivo: string, fazerBackup: () => string): ResultadoArquivo {
  const caminho = join(pasta, arquivo);
  const marcarErro = (motivo: string): ResultadoArquivo => {
    const falhaAoRenomear = renomear(caminho, 'erro');
    try { writeFileSync(`${caminho}.motivo.txt`, motivo + '\n'); } catch { /* pasta sem permissao */ }
    return {
      arquivo, situacao: 'erro',
      motivo: falhaAoRenomear ? `${motivo} (o arquivo continua na pasta: ${falhaAoRenomear})` : motivo,
    };
  };

  let dados: ArquivoImportacao;
  try {
    if (statSync(caminho).size > LIMITE_ARQUIVO) {
      throw new Error(`arquivo grande demais (o limite é ${LIMITE_ARQUIVO / 1024 / 1024} MB)`);
    }
    dados = esquemaImportacao.parse(JSON.parse(readFileSync(caminho, 'utf8').replace(/^﻿/, '')));
    conferirPlanos(dados);
  } catch (e) { return marcarErro(motivoDoErro(e)); }

  let backup: string;
  // sem backup nao importa; o arquivo fica para a proxima vez que o sistema abrir
  try { backup = fazerBackup(); } catch (e) {
    return { arquivo, situacao: 'aguardando', motivo: `Backup antes da importação falhou: ${motivoDoErro(e)}` };
  }

  let resumo: ResumoImportacao;
  try { resumo = importarAlunos(db, dados); } catch (e) { return marcarErro(motivoDoErro(e)); }

  // Daqui para baixo os dados JA entraram. Falhar ao renomear nao pode virar
  // "nada foi gravado": na proxima subida os nomes repetidos seguram a duplicata.
  const falhaAoRenomear = renomear(caminho, 'importado');
  return {
    arquivo, situacao: 'importado', resumo, backup,
    motivo: falhaAoRenomear ? `Importado. O arquivo continua na pasta (${falhaAoRenomear}); pode apagar.` : undefined,
  };
}

/**
 * Importa cada .json da pasta "importar". Roda quando o servidor sobe:
 * basta colocar o arquivo na pasta, sem botao. Antes de gravar, faz backup.
 * Com o banco ainda sem a conta do dono, espera -- a importacao nao pode
 * pular a configuracao inicial.
 */
export function importarDaPasta(db: Db, pasta: string, opcoes: { fazerBackup: () => string }): ResultadoArquivo[] {
  let nomes: string[];
  try { nomes = readdirSync(pasta).filter((n) => n.toLowerCase().endsWith('.json')).sort(); } catch { return []; }
  if (nomes.length === 0) return [];
  if (precisaConfigurar(db)) {
    return nomes.map((arquivo) => ({ arquivo, situacao: 'aguardando', motivo: 'Crie a conta do dono no painel primeiro' }));
  }
  // um arquivo problematico nunca derruba os outros
  return nomes.map((arquivo) => {
    try { return importarUm(db, pasta, arquivo, opcoes.fazerBackup); }
    catch (e) { return { arquivo, situacao: 'erro' as const, motivo: motivoDoErro(e) }; }
  });
}
