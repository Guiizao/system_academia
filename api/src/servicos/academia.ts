import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { academia } from '../db/schema.js';
import { montarBrCode } from '../dominio/pix.js';
import { ErroNegocio } from './erros.js';

type Db = BetterSQLite3Database<any>;

export interface DadosAcademia {
  nome?: string; cnpj?: string; endereco?: string; telefone?: string; whatsapp?: string; instagram?: string;
  pixChave?: string; pixTipo?: string; pixNomeRecebedor?: string; pixCidade?: string;
  diasAvisoVencimento?: number; diasAlunoSumido?: number;
}

export function criarServicoAcademia(db: Db) {
  function obter() {
    return db.select().from(academia).limit(1).get() ?? null;
  }

  /**
   * Salva os dados da academia. Se mexer no Pix, monta um BR Code de prova
   * antes de gravar: chave vazia ou dado que quebre o codigo e recusado aqui,
   * e nao descoberto no balcao na hora de cobrar.
   */
  function atualizar(d: DadosAcademia) {
    const atual = obter();
    if (!atual) throw new ErroNegocio('Academia ainda não configurada');
    if (d.nome !== undefined && !d.nome.trim()) throw new ErroNegocio('O nome da academia não pode ficar vazio');
    for (const k of ['diasAvisoVencimento', 'diasAlunoSumido'] as const) {
      if (d[k] !== undefined && (!Number.isInteger(d[k]) || d[k]! < 1 || d[k]! > 60)) {
        throw new ErroNegocio('Os prazos precisam ser um número de dias entre 1 e 60');
      }
    }
    const final = { ...atual, ...d };
    if (d.pixChave !== undefined || d.pixNomeRecebedor !== undefined || d.pixCidade !== undefined) {
      if (!final.pixChave?.trim()) throw new ErroNegocio('Informe a chave Pix');
      if (!final.pixNomeRecebedor?.trim()) throw new ErroNegocio('Informe o nome do recebedor (como aparece no banco)');
      if (!final.pixCidade?.trim()) throw new ErroNegocio('Informe a cidade do recebedor');
      montarBrCode({ chave: final.pixChave.trim(), nomeRecebedor: final.pixNomeRecebedor, cidade: final.pixCidade, valorCentavos: 100 });
    }
    const limpo: Record<string, unknown> = { atualizadoEm: new Date().toISOString() };
    for (const [k, v] of Object.entries(d)) limpo[k] = typeof v === 'string' ? (v.trim() || null) : v;
    return db.update(academia).set(limpo).where(eq(academia.id, atual.id)).returning().get();
  }

  return { obter, atualizar };
}
