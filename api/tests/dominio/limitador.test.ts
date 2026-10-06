import { describe, it, expect } from 'vitest';
import { criarLimitador } from '../../src/dominio/limitador.js';

const T0 = 1_000_000;

describe('criarLimitador', () => {
  it('deixa passar ate o limite dentro da janela', () => {
    const lim = criarLimitador({ max: 3, janelaMs: 60_000 });
    expect(lim.tentar('ip-a', T0).ok).toBe(true);
    expect(lim.tentar('ip-a', T0 + 10).ok).toBe(true);
    expect(lim.tentar('ip-a', T0 + 20).ok).toBe(true);
  });

  it('barra o seguinte e diz quantos segundos faltam', () => {
    const lim = criarLimitador({ max: 2, janelaMs: 60_000 });
    lim.tentar('ip-a', T0);
    lim.tentar('ip-a', T0 + 1000);
    const r = lim.tentar('ip-a', T0 + 2000);
    expect(r.ok).toBe(false);
    // a vaga volta 60s depois da tentativa mais antiga (T0), faltam 58s
    expect(r.esperarSeg).toBe(58);
  });

  it('libera de novo quando a janela passa', () => {
    const lim = criarLimitador({ max: 1, janelaMs: 60_000 });
    expect(lim.tentar('ip-a', T0).ok).toBe(true);
    expect(lim.tentar('ip-a', T0 + 59_000).ok).toBe(false);
    expect(lim.tentar('ip-a', T0 + 60_001).ok).toBe(true);
  });

  it('uma chave bloqueada nao atrapalha as outras', () => {
    const lim = criarLimitador({ max: 1, janelaMs: 60_000 });
    lim.tentar('ip-a', T0);
    expect(lim.tentar('ip-a', T0 + 10).ok).toBe(false);
    expect(lim.tentar('ip-b', T0 + 10).ok).toBe(true);
  });

  it('tentativa barrada NAO conta como nova tentativa', () => {
    // senao quem insiste empurra a propria janela para frente e fica preso
    // para sempre, mesmo tendo parado de tentar
    const lim = criarLimitador({ max: 1, janelaMs: 60_000 });
    lim.tentar('ip-a', T0);
    for (let i = 1; i <= 50; i++) lim.tentar('ip-a', T0 + i * 100);
    expect(lim.tentar('ip-a', T0 + 60_001).ok).toBe(true);
  });

  it('nao acumula memoria: chave parada e esquecida', () => {
    const lim = criarLimitador({ max: 5, janelaMs: 60_000 });
    for (let i = 0; i < 500; i++) lim.tentar(`ip-${i}`, T0 + i);
    expect(lim.tamanho()).toBe(500);
    // uma tentativa bem depois limpa o que ja saiu da janela
    lim.tentar('ip-novo', T0 + 200_000);
    expect(lim.tamanho()).toBe(1);
  });

  it('esquecer() zera a contagem de uma chave (login certo)', () => {
    const lim = criarLimitador({ max: 1, janelaMs: 60_000 });
    lim.tentar('ip-a', T0);
    expect(lim.tentar('ip-a', T0 + 10).ok).toBe(false);
    lim.esquecer('ip-a');
    expect(lim.tentar('ip-a', T0 + 20).ok).toBe(true);
  });

  it('recusa limite sem sentido', () => {
    expect(() => criarLimitador({ max: 0, janelaMs: 1000 })).toThrow();
    expect(() => criarLimitador({ max: 5, janelaMs: 0 })).toThrow();
  });
});
