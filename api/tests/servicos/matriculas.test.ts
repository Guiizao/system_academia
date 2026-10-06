import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoMatriculas } from '../../src/servicos/matriculas.js';
import { aluno, plano, academia } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let servico: ReturnType<typeof criarServicoMatriculas>;
let alunoId: number, planoId: number;

beforeEach(async () => {
  t = criarBancoDeTeste();
  servico = criarServicoMatriculas(t.db as any);
  await t.db.insert(academia).values({ nome: 'DARK FISIC' });
  const [a] = await t.db.insert(aluno)
    .values({ nome: 'Rafael', telefone: '+5511980001111' }).returning();
  const [p] = await t.db.insert(plano)
    .values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning();
  alunoId = a.id; planoId = p.id;
});
afterEach(() => t.fechar());

describe('servico de matriculas', () => {
  it('aluno sem matricula e inativo', async () => {
    expect(await servico.matriculaAtual(alunoId)).toBeNull();
    expect((await servico.statusDe(alunoId, '2026-09-08')).status).toBe('inativo');
  });

  it('primeira matricula grava periodo e valor do plano', async () => {
    const m = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    expect(m.dataInicio).toBe('2026-09-10');
    expect(m.dataFim).toBe('2026-10-10');
    expect(m.diaAncora).toBe(10);
    expect(m.valorCentavos).toBe(13900);
    expect(m.status).toBe('ativa');
  });

  it('renovacao adiantada emenda no vencimento anterior', async () => {
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    const m2 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-08' });
    expect(m2.dataInicio).toBe('2026-10-10');
    expect(m2.dataFim).toBe('2026-11-10');
  });

  it('renovacao atrasada conta do pagamento', async () => {
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    const m2 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-20' });
    expect(m2.dataInicio).toBe('2026-10-20');
    expect(m2.dataFim).toBe('2026-11-20');
    expect(m2.diaAncora).toBe(20);
  });

  it('renovar encerra a matricula anterior', async () => {
    const m1 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-10' });
    const atual = await servico.matriculaAtual(alunoId);
    expect(atual!.id).not.toBe(m1.id);
    expect(atual!.dataFim).toBe('2026-11-10');
  });

  it('congela o preco do plano no momento da contratacao', async () => {
    const m1 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    await t.db.update(plano).set({ precoCentavos: 19900 });
    expect(m1.valorCentavos).toBe(13900);
    const m2 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-10' });
    expect(m2.valorCentavos).toBe(19900);
  });

  it('status reflete a matricula vigente', async () => {
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    expect((await servico.statusDe(alunoId, '2026-09-15')).status).toBe('ativo');
    expect((await servico.statusDe(alunoId, '2026-10-07')).status).toBe('vencendo');
    expect((await servico.statusDe(alunoId, '2026-10-11')).status).toBe('vencido');
  });

  it('rejeita plano inexistente', async () => {
    await expect(
      servico.renovar({ alunoId, planoId: 9999, dataPagamento: '2026-09-10' })
    ).rejects.toThrow('Plano não encontrado');
  });
});
