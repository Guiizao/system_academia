import { describe, it, expect, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { precisaConfigurar, configurarPrimeiroAcesso } from '../../src/servicos/primeiro-acesso.js';
import { criarServicoAuth } from '../../src/servicos/auth.js';
import { garantirCatalogo } from '../../src/db/catalogo.js';
import { exercicio, tagRestricao } from '../../src/db/schema.js';
import { EXERCICIOS, TAGS_RESTRICAO } from '../../src/db/seed-dados.js';

let t: ReturnType<typeof criarBancoDeTeste>;
afterEach(() => t?.fechar());
const dados = { nomeAcademia: 'DARK FISIC', nome: 'Joao', email: 'joao@x.com', senha: 'senha-bem-longa' };

describe('primeiro acesso', () => {
  it('banco vazio precisa configurar; depois, nao', async () => {
    t = criarBancoDeTeste();
    expect(precisaConfigurar(t.db as any)).toBe(true);
    await configurarPrimeiroAcesso(t.db as any, dados);
    expect(precisaConfigurar(t.db as any)).toBe(false);
  });
  it('o dono criado consegue entrar', async () => {
    t = criarBancoDeTeste();
    await configurarPrimeiroAcesso(t.db as any, dados);
    const r = await criarServicoAuth(t.db as any).login('joao@x.com', 'senha-bem-longa');
    expect(r.usuario.papel).toBe('dono');
  });
  it('nao vira porta dos fundos: recusa num sistema ja configurado', async () => {
    t = criarBancoDeTeste();
    await configurarPrimeiroAcesso(t.db as any, dados);
    await expect(configurarPrimeiroAcesso(t.db as any, { ...dados, email: 'invasor@x.com' }))
      .rejects.toThrow('já foi configurado');
  });
  it('instalacao real ja vem com a biblioteca de exercicios (sem ela nao da para montar ficha)', async () => {
    t = criarBancoDeTeste();
    await configurarPrimeiroAcesso(t.db as any, dados);
    const lista = t.db.select().from(exercicio).all();
    expect(lista.length).toBe(EXERCICIOS.length);
    expect(lista.some((e) => e.contraindicacoes.includes('joelho'))).toBe(true);
    expect(t.db.select().from(tagRestricao).all().length).toBe(TAGS_RESTRICAO.length);
  });
  it('garantirCatalogo nao duplica e nao ressuscita exercicio desativado', () => {
    t = criarBancoDeTeste();
    garantirCatalogo(t.db as any);
    t.db.update(exercicio).set({ ativo: false }).run();
    garantirCatalogo(t.db as any);
    expect(t.db.select().from(exercicio).all().length).toBe(EXERCICIOS.length);
    expect(t.db.select().from(exercicio).all().every((e) => !e.ativo)).toBe(true);
  });
  it('recusa senha curta', async () => {
    t = criarBancoDeTeste();
    await expect(configurarPrimeiroAcesso(t.db as any, { ...dados, senha: 'curta' })).rejects.toThrow('10 caracteres');
  });
});
