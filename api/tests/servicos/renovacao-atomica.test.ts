import { describe, it, expect, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoMatriculas } from '../../src/servicos/matriculas.js';
import { aluno, plano, academia } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
afterEach(() => t?.fechar());

describe('renovacao e atomica', () => {
  it('se a nova matricula falhar, a anterior continua ativa', async () => {
    t = criarBancoDeTeste();
    const servico = criarServicoMatriculas(t.db as any);
    await t.db.insert(academia).values({ nome: 'DARK FISIC' });
    const [a] = await t.db.insert(aluno).values({ nome: 'Rafael', telefone: '+5511980001111' }).returning();
    const [p] = await t.db.insert(plano).values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning();

    const m1 = await servico.renovar({ alunoId: a.id, planoId: p.id, dataPagamento: '2026-09-10' });

    // simula uma falha no meio: a SEGUNDA insercao em matricula aborta
    t.sqlite.exec(`
      CREATE TRIGGER falha_insert BEFORE INSERT ON matricula
      BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;
    `);

    await expect(
      servico.renovar({ alunoId: a.id, planoId: p.id, dataPagamento: '2026-10-10' })
    ).rejects.toThrow('falha simulada');

    // o aluno NAO pode ficar sem matricula ativa por causa de uma falha
    const atual = await servico.matriculaAtual(a.id);
    expect(atual?.id).toBe(m1.id);
    expect(atual?.status).toBe('ativa');
  });
});
