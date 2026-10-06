import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoAcademia } from '../../src/servicos/academia.js';
import { criarServicoFinanceiro } from '../../src/servicos/financeiro.js';
import { academia, aluno, cobranca } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let s: ReturnType<typeof criarServicoAcademia>;
beforeEach(() => {
  t = criarBancoDeTeste();
  s = criarServicoAcademia(t.db as any);
  t.db.insert(academia).values({ nome: 'DARK FISIC' }).run(); // como sai da primeira configuracao: sem Pix
});
afterEach(() => t.fechar());

describe('dados da academia', () => {
  it('instalacao nova nao tem Pix; depois de configurar, a cobranca gera o codigo', () => {
    const fin = criarServicoFinanceiro(t.db as any);
    const alunoId = t.db.insert(aluno).values({ nome: 'Rafael', telefone: '+5511980001111' }).returning().get().id;
    const c = t.db.insert(cobranca).values({ alunoId, competencia: '2026-09', valorCentavos: 13900, vencimento: '2026-09-30' }).returning().get();
    expect(() => fin.pixDaCobranca(c.id)).toThrow('Chave Pix');
    s.atualizar({ pixChave: '12.345.678/0001-90', pixTipo: 'cnpj', pixNomeRecebedor: 'Dark Fisic Academia', pixCidade: 'São Paulo' });
    expect(fin.pixDaCobranca(c.id).payload).toContain('5406139.00');
  });
  it('recusa Pix incompleto antes de gravar', () => {
    expect(() => s.atualizar({ pixChave: 'x@y.com' })).toThrow('nome do recebedor');
    expect(s.obter()?.pixChave).toBeNull();
  });
  it('recusa prazo fora de 1 a 60 dias e nome vazio', () => {
    expect(() => s.atualizar({ diasAvisoVencimento: 0 })).toThrow('entre 1 e 60');
    expect(() => s.atualizar({ nome: '  ' })).toThrow('não pode ficar vazio');
  });
  it('atualiza prazos e contato', () => {
    const r = s.atualizar({ diasAvisoVencimento: 7, instagram: '@darkfisic' });
    expect(r.diasAvisoVencimento).toBe(7);
    expect(r.instagram).toBe('@darkfisic');
  });
});
