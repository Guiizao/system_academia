import { eq, desc, like, or, and } from 'drizzle-orm';
import { normalizarRestricoes } from '../dominio/restricoes.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { aluno, avaliacaoFisica, plano, academia, cobranca } from '../db/schema.js';
import { normalizarTelefone } from '../dominio/telefone.js';
import { statusDoAluno, diasParaVencer, type StatusAluno } from '../dominio/status.js';
import { hoje, type DataISO } from '../dominio/datas.js';
import { criarServicoMatriculas } from './matriculas.js';
import { criarServicoCheckins } from './checkins.js';
import { ErroNegocio, ErroNaoEncontrado } from './erros.js';

type Db = BetterSQLite3Database<any>;

export interface NovoAluno {
  nome: string; telefone: string; email?: string; cpf?: string;
  dataNascimento?: string; sexo?: string; endereco?: string;
  observacoesMedicas?: string; restricoes?: string[];
  aceitaWhatsapp?: boolean; consentimentoLgpd: boolean;
}

export function criarServicoAlunos(db: Db) {
  const matriculas = criarServicoMatriculas(db);
  const checkins = criarServicoCheckins(db);

  function diasAviso() {
    return db.select().from(academia).limit(1).get()?.diasAvisoVencimento ?? 5;
  }

  /** Aluno com tudo que a tela precisa. Status DERIVADO, nunca lido do banco. */
  function comStatus(a: typeof aluno.$inferSelect, hojeISO: DataISO, aviso: number) {
    const m = matriculas.matriculaAtualSync(a.id);
    const p = m ? db.select({ nome: plano.nome }).from(plano).where(eq(plano.id, m.planoId)).get() : null;
    const ultimaAvaliacao = db.select().from(avaliacaoFisica)
      .where(eq(avaliacaoFisica.alunoId, a.id)).orderBy(desc(avaliacaoFisica.data)).limit(1).get() ?? null;
    const ultimoCheckin = checkins.ultimoDe(a.id);
    return {
      ...a,
      matricula: m,
      planoNome: p?.nome ?? null,
      status: statusDoAluno(m?.dataFim ?? null, hojeISO, aviso) as StatusAluno,
      diasParaVencer: diasParaVencer(m?.dataFim ?? null, hojeISO),
      ultimaAvaliacao,
      checkinsNoMes: checkins.contagemNoMes(a.id, hojeISO.slice(0, 7)),
      ultimoCheckin: ultimoCheckin?.dataLocal ?? null,
      // hora exata: a tela usa para segurar o botao ate liberar o proximo
      ultimoCheckinEm: ultimoCheckin?.dataHora ?? null,
    };
  }

  function listar(filtro: { busca?: string; status?: StatusAluno | 'todos' } = {}, hojeISO = hoje()) {
    const q = (filtro.busca ?? '').trim();
    const digitos = q.replace(/\D/g, '');
    const condicao = q
      ? and(eq(aluno.ativo, true), or(
          like(aluno.nome, `%${q}%`),
          ...(digitos ? [like(aluno.telefone, `%${digitos}%`)] : []),
        ))
      : eq(aluno.ativo, true);

    const aviso = diasAviso();
    return db.select().from(aluno).where(condicao).all()
      .map((a) => comStatus(a, hojeISO, aviso))
      .filter((a) => !filtro.status || filtro.status === 'todos' || a.status === filtro.status)
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  }

  function obter(id: number, hojeISO = hoje()) {
    const a = db.select().from(aluno).where(eq(aluno.id, id)).get();
    return a ? comStatus(a, hojeISO, diasAviso()) : null;
  }

  function criar(dados: NovoAluno) {
    if (!dados.nome?.trim()) throw new ErroNegocio('Nome é obrigatório');
    if (!dados.consentimentoLgpd) {
      throw new ErroNegocio('É preciso registrar o consentimento LGPD (medidas e restrições são dado sensível)');
    }
    let telefone: string;
    try { telefone = normalizarTelefone(dados.telefone); }
    catch { throw new ErroNegocio('Telefone inválido'); }

    try {
      return db.insert(aluno).values({
        nome: dados.nome.trim(), telefone,
        email: dados.email || null, cpf: dados.cpf || null,
        dataNascimento: dados.dataNascimento || null, sexo: dados.sexo || null,
        endereco: dados.endereco || null, observacoesMedicas: dados.observacoesMedicas || null,
        restricoes: normalizarRestricoes(dados.restricoes), aceitaWhatsapp: !!dados.aceitaWhatsapp,
        consentimentoLgpdEm: new Date().toISOString(),
      }).returning().get();
    } catch (e: any) {
      if (String(e.message).includes('UNIQUE') && String(e.message).includes('cpf')) {
        throw new ErroNegocio('Já existe aluno com este CPF');
      }
      throw e;
    }
  }

  function avaliacoes(alunoId: number) {
    return db.select().from(avaliacaoFisica).where(eq(avaliacaoFisica.alunoId, alunoId))
      .orderBy(desc(avaliacaoFisica.data)).all();
  }

  function registrarAvaliacao(dados: typeof avaliacaoFisica.$inferInsert) {
    const a = db.select({ id: aluno.id }).from(aluno).where(eq(aluno.id, dados.alunoId)).get();
    if (!a) throw new ErroNaoEncontrado('Aluno não encontrado');
    return db.insert(avaliacaoFisica).values({ ...dados, data: dados.data || hoje() }).returning().get();
  }

  /** Edita dados do aluno. ativo=false e a exclusao logica (spec 11): o historico fica. */
  function atualizar(id: number, d: Partial<NovoAluno> & { ativo?: boolean; endereco?: string }) {
    const atual = db.select().from(aluno).where(eq(aluno.id, id)).get();
    if (!atual) throw new ErroNaoEncontrado('Aluno não encontrado');
    const m: Partial<typeof aluno.$inferInsert> = { atualizadoEm: new Date().toISOString() };
    if (d.nome !== undefined) {
      if (!d.nome.trim()) throw new ErroNegocio('Nome é obrigatório');
      m.nome = d.nome.trim();
    }
    if (d.telefone !== undefined) {
      try { m.telefone = normalizarTelefone(d.telefone); } catch { throw new ErroNegocio('Telefone inválido'); }
    }
    for (const k of ['email', 'cpf', 'dataNascimento', 'sexo', 'endereco', 'observacoesMedicas'] as const) {
      if (d[k] !== undefined) (m as any)[k] = (d[k] as string)?.trim() || null;
    }
    if (d.restricoes !== undefined) m.restricoes = normalizarRestricoes(d.restricoes);
    if (d.aceitaWhatsapp !== undefined) m.aceitaWhatsapp = d.aceitaWhatsapp;
    if (d.ativo !== undefined) m.ativo = d.ativo;
    try {
      db.transaction((tx) => {
        tx.update(aluno).set(m).where(eq(aluno.id, id)).run();
        // quem saiu da academia nao deve: sem isso a inadimplencia cresce para sempre
        if (d.ativo === false) {
          tx.update(cobranca).set({ status: 'cancelada' })
            .where(and(eq(cobranca.alunoId, id), eq(cobranca.status, 'aberta'))).run();
        }
      });
    } catch (e: any) {
      if (String(e.message).includes('UNIQUE') && String(e.message).includes('cpf')) {
        throw new ErroNegocio('Já existe aluno com este CPF');
      }
      throw e;
    }
    return obter(id);
  }

  return { listar, obter, criar, atualizar, avaliacoes, registrarAvaliacao };
}
