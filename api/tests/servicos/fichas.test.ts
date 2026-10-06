import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoFichas } from '../../src/servicos/fichas.js';
import { aluno, usuario, exercicio } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let s: ReturnType<typeof criarServicoFichas>;
let alunoId: number, donoSemCref: number, professor: number, recepcao: number, exId: number;

beforeEach(() => {
  t = criarBancoDeTeste();
  s = criarServicoFichas(t.db as any);
  alunoId = t.db.insert(aluno).values({ nome: 'Bruno', telefone: '+5511980007777' }).returning().get().id;
  donoSemCref = t.db.insert(usuario).values({ nome: 'Joao', email: 'j@x', papel: 'dono' }).returning().get().id;
  professor = t.db.insert(usuario).values({ nome: 'Pedro', email: 'p@x', papel: 'professor', cref: '123456-G/SP' }).returning().get().id;
  recepcao = t.db.insert(usuario).values({ nome: 'Bruna', email: 'b@x', papel: 'recepcao' }).returning().get().id;
  exId = t.db.insert(exercicio).values({
    nome: 'Leg press', grupoMuscular: 'pernas', padraoMovimento: 'agachar',
    equipamento: 'Leg Press', nivelMinimo: 'iniciante',
  }).returning().get().id;
});
afterEach(() => t.fechar());

const ficha = (exercicioId: number) => ({
  alunoId: 0, objetivo: 'emagrecimento', nivel: 'iniciante', diasPorSemana: 3,
  divisoes: [{ rotulo: 'A', foco: 'Corpo inteiro', itens: [
    { exercicioId, series: 3, reps: '12', descansoSeg: 60 },
  ]}],
});

describe('liberacao da ficha', () => {
  // Decisao do dono (25/09/2026): o CREF avisa, nao bloqueia. Mas fica
  // registrado quem liberou e se tinha CREF -- e disso que a tela avisa.
  it('quem nao tem CREF libera, e a ficha registra a falta', () => {
    const f = s.criar({ ...ficha(exId), alunoId }, donoSemCref);
    const ok = s.aprovar(f.id, donoSemCref);
    expect(ok.status).toBe('aprovada');
    expect(ok.aprovadaPorUsuarioId).toBe(donoSemCref);
    expect(ok.aprovadaCref).toBeNull();
    expect(ok.aprovadaEm).toBeTruthy();
  });

  it('CREF em branco nao vira assinatura vazia', () => {
    const semNada = t.db.insert(usuario).values({ nome: 'Ze', email: 'z@x', papel: 'professor', cref: '   ' }).returning().get().id;
    const f = s.criar({ ...ficha(exId), alunoId }, semNada);
    expect(s.aprovar(f.id, semNada).aprovadaCref).toBeNull();
  });

  it('recepcao tambem libera (decisao do dono), e fica registrada como sem CREF', () => {
    const f = s.criar({ ...ficha(exId), alunoId }, donoSemCref);
    const ok = s.aprovar(f.id, recepcao);
    expect(ok.status).toBe('aprovada');
    expect(ok.aprovadaPorUsuarioId).toBe(recepcao);
    expect(ok.aprovadaCref).toBeNull();
  });

  it('professor com CREF libera, e a assinatura e DELE', () => {
    const f = s.criar({ ...ficha(exId), alunoId }, donoSemCref);
    const ok = s.aprovar(f.id, professor);
    expect(ok.status).toBe('aprovada');
    expect(ok.aprovadaPorUsuarioId).toBe(professor);
    expect(ok.aprovadaCref).toBe('123456-G/SP');
  });

  it('nao libera duas vezes', () => {
    const f = s.criar({ ...ficha(exId), alunoId }, professor);
    s.aprovar(f.id, professor);
    expect(() => s.aprovar(f.id, professor)).toThrow('Só rascunhos');
  });
});

describe('biblioteca', () => {
  it('recusa exercicio fora da biblioteca', () => {
    expect(() => s.criar({ ...ficha(999), alunoId }, professor)).toThrow('fora da biblioteca');
  });

  it('ficha manual nasce rascunho e detalha com nome do exercicio', () => {
    const f = s.criar({ ...ficha(exId), alunoId }, professor);
    expect(f.status).toBe('rascunho');
    const d = s.detalhar(f.id)!;
    expect(d.divisoes[0].itens[0].exercicioNome).toBe('Leg press');
  });
});

describe('IA desativada', () => {
  it('gerarComIA recusa com 503', () => {
    try { s.gerarComIA(); expect.unreachable(); }
    catch (e: any) { expect(e.status).toBe(503); expect(e.message).toMatch(/desativada/); }
  });
});

describe('restricoes do aluno', () => {
  it('recusa exercicio contraindicado para as restricoes do aluno', () => {
    const joelho = t.db.insert(aluno).values({ nome: 'Carla', telefone: '+5511980009999', restricoes: ['joelho'] }).returning().get().id;
    const agachamento = t.db.insert(exercicio).values({
      nome: 'Agachamento livre', grupoMuscular: 'pernas', padraoMovimento: 'agachar',
      equipamento: 'Barra livre', nivelMinimo: 'intermediario', contraindicacoes: ['joelho', 'lombar'],
    }).returning().get().id;
    expect(() => s.criar({ ...ficha(agachamento), alunoId: joelho }, professor))
      .toThrow('contraindicado');
  });
  it('aceita o mesmo exercicio para quem nao tem a restricao', () => {
    const agachamento = t.db.insert(exercicio).values({
      nome: 'Agachamento livre', grupoMuscular: 'pernas', padraoMovimento: 'agachar',
      equipamento: 'Barra livre', nivelMinimo: 'intermediario', contraindicacoes: ['joelho'],
    }).returning().get().id;
    expect(s.criar({ ...ficha(agachamento), alunoId }, professor).status).toBe('rascunho');
  });
});

