import { describe, it, expect, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { aluno, plano } from '../../src/db/schema.js';

let fechar: (() => void) | undefined;
afterEach(() => fechar?.());

describe('schema', () => {
  it('insere e le um aluno', async () => {
    const t = criarBancoDeTeste(); fechar = t.fechar;
    await t.db.insert(aluno).values({
      nome: 'Rafael Moura', telefone: '+5511980001111', aceitaWhatsapp: true,
    });
    const linhas = await t.db.select().from(aluno);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].nome).toBe('Rafael Moura');
    expect(linhas[0].ativo).toBe(true);
  });

  it('guarda preco em centavos inteiros', async () => {
    const t = criarBancoDeTeste(); fechar = t.fechar;
    await t.db.insert(plano).values({
      nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1,
    });
    const [p] = await t.db.select().from(plano);
    expect(p.precoCentavos).toBe(13900);
  });

  it('impede cpf duplicado', async () => {
    const t = criarBancoDeTeste(); fechar = t.fechar;
    await t.db.insert(aluno).values({ nome: 'A', telefone: '+5511980001111', cpf: '111.222.333-01' });
    await expect(
      t.db.insert(aluno).values({ nome: 'B', telefone: '+5511980002222', cpf: '111.222.333-01' })
    ).rejects.toThrow();
  });

  it('FK ativa: recusa matricula com aluno inexistente', async () => {
    const t = criarBancoDeTeste(); fechar = t.fechar;
    const { matricula } = await import('../../src/db/schema.js');
    await t.db.insert(plano).values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 });
    await expect(
      t.db.insert(matricula).values({
        alunoId: 999, planoId: 1, dataInicio: '2026-09-10', dataFim: '2026-10-10',
        diaAncora: 10, valorCentavos: 13900,
      })
    ).rejects.toThrow();
  });
});
