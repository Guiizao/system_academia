import { describe, it, expect } from 'vitest';
import { statusDoAluno, diasParaVencer } from '../../src/dominio/status.js';

const HOJE = '2026-09-08';

describe('statusDoAluno', () => {
  it('sem matricula e inativo', () => {
    expect(statusDoAluno(null, HOJE, 5)).toBe('inativo');
  });
  it('vencimento no futuro distante e ativo', () => {
    expect(statusDoAluno('2026-10-08', HOJE, 5)).toBe('ativo');
  });
  it('dentro da janela de aviso e vencendo', () => {
    expect(statusDoAluno('2026-09-13', HOJE, 5)).toBe('vencendo');
    expect(statusDoAluno('2026-09-09', HOJE, 5)).toBe('vencendo');
  });
  it('vence exatamente hoje ainda e vencendo, nao vencido', () => {
    expect(statusDoAluno(HOJE, HOJE, 5)).toBe('vencendo');
  });
  it('ontem ja e vencido', () => {
    expect(statusDoAluno('2026-09-07', HOJE, 5)).toBe('vencido');
  });
  it('respeita janela de aviso configurada', () => {
    expect(statusDoAluno('2026-09-13', HOJE, 3)).toBe('ativo');
    expect(statusDoAluno('2026-09-13', HOJE, 10)).toBe('vencendo');
  });
});

describe('diasParaVencer', () => {
  it('positivo no futuro, negativo no passado', () => {
    expect(diasParaVencer('2026-09-13', HOJE)).toBe(5);
    expect(diasParaVencer('2026-09-01', HOJE)).toBe(-7);
    expect(diasParaVencer(null, HOJE)).toBeNull();
  });
});
