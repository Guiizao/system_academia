import { describe, it, expect, beforeEach } from 'vitest';
import {
  chaveRascunho, salvarRascunho, lerRascunho, limparRascunho, limparRascunhosDoUsuario, VALIDADE_MS,
} from '../src/dominio/rascunho';

/** localStorage de mentira: os testes rodam no Node, sem navegador. */
function lojaFalsa(falhar = false): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => { if (falhar) throw new Error('sem armazenamento'); return m.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (falhar) throw new Error('sem armazenamento'); m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  } as Storage;
}

let loja: Storage;
const CHAVE = chaveRascunho(7, 'aluno');
beforeEach(() => { loja = lojaFalsa(); });

describe('rascunho', () => {
  it('a chave separa usuario, formulario e aluno', () => {
    expect(chaveRascunho(7, 'ficha', 42)).toBe('df-rascunho:7:ficha:42');
    expect(chaveRascunho(7, 'aluno')).toBe('df-rascunho:7:aluno:novo');
    expect(chaveRascunho(9, 'ficha', 42)).not.toBe(chaveRascunho(7, 'ficha', 42));
  });

  it('guarda e devolve o que estava sendo digitado', () => {
    salvarRascunho(CHAVE, { nome: 'Ana', telefone: '(14) 9 9999-0000' }, loja);
    expect(lerRascunho(CHAVE, loja)).toEqual({ nome: 'Ana', telefone: '(14) 9 9999-0000' });
  });

  it('depois de 24 horas o rascunho nao volta mais', () => {
    salvarRascunho(CHAVE, { nome: 'Ana' }, loja, Date.now() - VALIDADE_MS - 1000);
    expect(lerRascunho(CHAVE, loja)).toBeNull();
  });

  it('dentro das 24 horas ainda volta', () => {
    salvarRascunho(CHAVE, { nome: 'Ana' }, loja, Date.now() - VALIDADE_MS + 60_000);
    expect(lerRascunho(CHAVE, loja)).toEqual({ nome: 'Ana' });
  });

  it('conteudo estragado no navegador nao quebra a tela', () => {
    loja.setItem(CHAVE, '{isso nao e json');
    expect(lerRascunho(CHAVE, loja)).toBeNull();
  });

  it('salvar vira apagar quando nao ha nada digitado', () => {
    salvarRascunho(CHAVE, { nome: 'Ana' }, loja);
    salvarRascunho(CHAVE, null, loja);
    expect(lerRascunho(CHAVE, loja)).toBeNull();
  });

  it('limpar apaga so o rascunho pedido', () => {
    salvarRascunho(CHAVE, { nome: 'Ana' }, loja);
    salvarRascunho(chaveRascunho(7, 'ficha', 42), { divisao: 'A' }, loja);
    limparRascunho(CHAVE, loja);
    expect(lerRascunho(CHAVE, loja)).toBeNull();
    expect(lerRascunho(chaveRascunho(7, 'ficha', 42), loja)).toEqual({ divisao: 'A' });
  });

  it('ao sair, limpa so os rascunhos de quem saiu', () => {
    salvarRascunho(chaveRascunho(7, 'aluno'), { nome: 'Ana' }, loja);
    salvarRascunho(chaveRascunho(7, 'ficha', 1), { divisao: 'A' }, loja);
    salvarRascunho(chaveRascunho(9, 'aluno'), { nome: 'Bia' }, loja);
    loja.setItem('df-tema', 'marrom');
    limparRascunhosDoUsuario(7, loja);
    expect(lerRascunho(chaveRascunho(7, 'aluno'), loja)).toBeNull();
    expect(lerRascunho(chaveRascunho(7, 'ficha', 1), loja)).toBeNull();
    expect(lerRascunho(chaveRascunho(9, 'aluno'), loja)).toEqual({ nome: 'Bia' });
    expect(loja.getItem('df-tema')).toBe('marrom');
  });

  it('navegador sem armazenamento (aba anonima) nao derruba o formulario', () => {
    const ruim = lojaFalsa(true);
    expect(() => salvarRascunho(CHAVE, { nome: 'Ana' }, ruim)).not.toThrow();
    expect(lerRascunho(CHAVE, ruim)).toBeNull();
    expect(() => limparRascunhosDoUsuario(7, ruim)).not.toThrow();
  });
});
