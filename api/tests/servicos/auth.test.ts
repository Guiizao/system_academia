import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoAuth, hashSenha } from '../../src/servicos/auth.js';
import { usuario } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let auth: ReturnType<typeof criarServicoAuth>;

beforeEach(async () => {
  t = criarBancoDeTeste();
  auth = criarServicoAuth(t.db as any);
  t.db.insert(usuario).values({
    nome: 'Joao', email: 'joao@darkfisic.com', papel: 'dono', senhaHash: await hashSenha('senha-forte-123'),
  }).run();
});
afterEach(() => t.fechar());

describe('auth', () => {
  it('login certo devolve token e nunca o hash', async () => {
    const r = await auth.login('joao@darkfisic.com', 'senha-forte-123');
    expect(r.token).toMatch(/^[0-9a-f]{64}$/);
    expect((r.usuario as any).senhaHash).toBeUndefined();
    expect(auth.usuarioDaSessao(r.token)?.nome).toBe('Joao');
  });

  it('e-mail sem diferenciar maiusculas', async () => {
    await expect(auth.login('  JOAO@darkfisic.com ', 'senha-forte-123')).resolves.toBeTruthy();
  });

  it('senha errada e e-mail inexistente dao a MESMA mensagem', async () => {
    await expect(auth.login('joao@darkfisic.com', 'errada')).rejects.toThrow('E-mail ou senha incorretos');
    await expect(auth.login('ninguem@x.com', 'errada')).rejects.toThrow('E-mail ou senha incorretos');
  });

  it('bloqueia apos 5 falhas, mesmo com a senha certa', async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      await expect(auth.login('joao@darkfisic.com', 'x', t0)).rejects.toThrow();
    }
    await expect(auth.login('joao@darkfisic.com', 'senha-forte-123', t0 + 1000)).rejects.toThrow('Muitas tentativas');
    await expect(auth.login('joao@darkfisic.com', 'senha-forte-123', t0 + 61_000)).resolves.toBeTruthy();
  });

  it('sessao expira em 12h', async () => {
    const t0 = Date.now();
    const r = await auth.login('joao@darkfisic.com', 'senha-forte-123', t0);
    expect(auth.usuarioDaSessao(r.token, t0 + 11 * 3600_000)).not.toBeNull();
    expect(auth.usuarioDaSessao(r.token, t0 + 13 * 3600_000)).toBeNull();
  });

  it('logout invalida o token', async () => {
    const r = await auth.login('joao@darkfisic.com', 'senha-forte-123');
    auth.logout(r.token);
    expect(auth.usuarioDaSessao(r.token)).toBeNull();
  });
});
