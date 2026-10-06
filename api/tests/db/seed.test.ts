import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { semear } from '../../src/db/seed.js';
import { criarServicoAlunos } from '../../src/servicos/alunos.js';
import { criarServicoDashboard } from '../../src/servicos/dashboard.js';
import * as t from '../../src/db/schema.js';

let b: ReturnType<typeof criarBancoDeTeste>;
const H = '2026-09-21';
let r: Awaited<ReturnType<typeof semear>>;

beforeAll(async () => { b = criarBancoDeTeste(); r = await semear(b.db as any, { hojeISO: H }); });
afterAll(() => b.fechar());

describe('seed', () => {
  it('gera volume realista', () => {
    expect(r.contadores.alunos).toBe(40);
    expect(r.contadores.pagamentos).toBeGreaterThan(40);
    expect(r.contadores.checkins).toBeGreaterThan(200);
  });

  it('o dashboard tem todos os estados para mostrar', () => {
    const d = criarServicoDashboard(b.db as any).resumo(H);
    expect(d.ativos).toBeGreaterThan(0);
    expect(d.vencendo).toBeGreaterThan(0);
    expect(d.vencidos).toBeGreaterThan(0);
    expect(d.inativos).toBeGreaterThan(0);
    expect(d.sumidos.length).toBeGreaterThan(0);
    expect(d.inadimplenciaCentavos).toBeGreaterThan(0);
  });

  it('cada aluno tem no maximo UMA matricula ativa', () => {
    const ativas = b.db.select().from(t.matricula).where(eq(t.matricula.status, 'ativa')).all();
    const porAluno = new Set(ativas.map((m) => m.alunoId));
    expect(porAluno.size).toBe(ativas.length);
  });

  it('nenhuma ficha tem exercicio contraindicado para o proprio aluno', () => {
    const itens = b.db.select({
      restricoes: t.aluno.restricoes, contra: t.exercicio.contraindicacoes, ex: t.exercicio.nome, al: t.aluno.nome,
    }).from(t.fichaItem)
      .innerJoin(t.exercicio, eq(t.exercicio.id, t.fichaItem.exercicioId))
      .innerJoin(t.fichaDivisao, eq(t.fichaDivisao.id, t.fichaItem.divisaoId))
      .innerJoin(t.fichaTreino, eq(t.fichaTreino.id, t.fichaDivisao.fichaId))
      .innerJoin(t.aluno, eq(t.aluno.id, t.fichaTreino.alunoId)).all();
    const violacoes = itens.filter((i) => i.contra.some((c) => i.restricoes.includes(c)));
    expect(violacoes).toEqual([]);
  });

  it('ficha aprovada sempre tem assinatura com CREF', () => {
    const aprovadas = b.db.select().from(t.fichaTreino).where(eq(t.fichaTreino.status, 'aprovada')).all();
    expect(aprovadas.length).toBeGreaterThan(0);
    for (const f of aprovadas) { expect(f.aprovadaCref).toBeTruthy(); expect(f.aprovadaPorUsuarioId).toBeTruthy(); }
  });

  it('e deterministico: mesma semente, mesmos alunos', async () => {
    const nomes1 = criarServicoAlunos(b.db as any).listar({}, H).map((a) => a.nome);
    const b2 = criarBancoDeTeste();
    await semear(b2.db as any, { hojeISO: H });
    const nomes2 = criarServicoAlunos(b2.db as any).listar({}, H).map((a) => a.nome);
    b2.fechar();
    expect(nomes2).toEqual(nomes1);
  });
});
