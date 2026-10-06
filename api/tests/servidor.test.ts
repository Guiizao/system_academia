import { describe, it, expect } from 'vitest';
import { construirServidor } from '../src/servidor.js';

describe('servidor', () => {
  it('responde /status com versao e ok', async () => {
    const app = construirServidor();
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });

  it('a versao vem do app de PC (DF_VERSAO): no instalador nao existe npm', async () => {
    process.env.DF_VERSAO = '9.9.9';
    try {
      const app = construirServidor();
      const res = await app.inject({ method: 'GET', url: '/status' });
      expect(res.json().versao).toBe('9.9.9');
      await app.close();
    } finally {
      delete process.env.DF_VERSAO;
    }
  });
});
