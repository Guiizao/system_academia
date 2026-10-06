import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoUsuarios } from '../../src/servicos/usuarios.js';
import { criarServicoAuth, hashSenha } from '../../src/servicos/auth.js';
import { usuario } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let us: ReturnType<typeof criarServicoUsuarios>;
let auth: ReturnType<typeof criarServicoAuth>;
let donoId: number;
const SENHA = 'senha-do-dono-123';

beforeEach(async () => {
  t = criarBancoDeTeste();
  us = criarServicoUsuarios(t.db as any);
  auth = criarServicoAuth(t.db as any);
  donoId = t.db.insert(usuario).values({
    nome: 'Joao', email: 'joao@df.com', papel: 'dono', senhaHash: await hashSenha(SENHA),
  }).returning().get().id;
});
afterEach(() => t.fechar());

const recepcionista = () => us.criar({ nome: 'Bruna', email: 'Bruna@DF.com', papel: 'recepcao', senhaInicial: 'senha-bruna-123' });

describe('cadastro da equipe', () => {
  it('dono cria recepcionista e ela consegue entrar', async () => {
    const b = await recepcionista();
    expect(b.email).toBe('bruna@df.com');
    expect((b as any).senhaHash).toBeUndefined();
    expect((await auth.login('bruna@df.com', 'senha-bruna-123')).usuario.papel).toBe('recepcao');
  });
  it('recusa e-mail repetido e senha curta', async () => {
    await recepcionista();
    await expect(recepcionista()).rejects.toThrow('Já existe');
    await expect(us.criar({ nome: 'X', email: 'x@df.com', papel: 'professor', senhaInicial: 'curta' })).rejects.toThrow('10 caracteres');
  });
});

describe('travas', () => {
  it('ninguem desativa a si mesmo', () => {
    expect(() => us.atualizar(donoId, { ativo: false }, donoId)).toThrow('a si mesmo');
  });
  it('nunca fica sem dono ativo', async () => {
    const b = await recepcionista();
    expect(() => us.atualizar(donoId, { papel: 'recepcao' }, b.id)).toThrow('pelo menos um dono');
  });
  it('com dois donos, um pode deixar de ser dono', async () => {
    const socio = await us.criar({ nome: 'Socio', email: 's@df.com', papel: 'dono', senhaInicial: 'senha-socio-123' });
    expect(us.atualizar(donoId, { papel: 'recepcao' }, socio.id).papel).toBe('recepcao');
  });
  it('desativar derruba a sessao aberta na hora', async () => {
    await recepcionista();
    const { token, usuario: b } = await auth.login('bruna@df.com', 'senha-bruna-123');
    us.atualizar(b.id, { ativo: false }, donoId);
    expect(auth.usuarioDaSessao(token)).toBeNull();
    await expect(auth.login('bruna@df.com', 'senha-bruna-123')).rejects.toThrow();
  });
});

describe('senhas', () => {
  it('dono redefine a senha de quem esqueceu', async () => {
    const b = await recepcionista();
    const { token } = await auth.login('bruna@df.com', 'senha-bruna-123');
    await us.redefinirSenha(b.id, 'senha-nova-da-bruna');
    expect(auth.usuarioDaSessao(token)).toBeNull();
    expect((await auth.login('bruna@df.com', 'senha-nova-da-bruna')).usuario.id).toBe(b.id);
  });
  it('trocar a propria senha exige a atual', async () => {
    await expect(us.trocarPropriaSenha(donoId, 'errada', 'nova-senha-longa-1')).rejects.toThrow('Senha atual incorreta');
  });
  it('trocar a propria senha mantem esta sessao e derruba as outras', async () => {
    const aqui = (await auth.login('joao@df.com', SENHA)).token;
    const celular = (await auth.login('joao@df.com', SENHA)).token;
    await us.trocarPropriaSenha(donoId, SENHA, 'nova-senha-longa-1', aqui);
    expect(auth.usuarioDaSessao(aqui)).not.toBeNull();
    expect(auth.usuarioDaSessao(celular)).toBeNull();
  });
});
