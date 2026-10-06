import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoAulas } from '../../src/servicos/aulas.js';
import { aluno } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let s: ReturnType<typeof criarServicoAulas>;
let a1: number, a2: number, a3: number, aulaId: number;
const SEG = '2026-09-21'; // segunda-feira

beforeEach(() => {
  t = criarBancoDeTeste();
  s = criarServicoAulas(t.db as any);
  [a1, a2, a3] = ['A', 'B', 'C'].map((n, i) =>
    t.db.insert(aluno).values({ nome: n, telefone: `+551198000000${i}` }).returning().get().id);
  aulaId = s.criar({ nome: 'Spinning', diaSemana: 1, hora: '06:30', vagas: 2 }).id;
});
afterEach(() => t.fechar());

describe('aulas', () => {
  it('lista quem ja esta inscrito na sessao', () => {
    s.inscrever(aulaId, a1, SEG);
    expect(s.alunosInscritos(aulaId, SEG)).toEqual([a1]);
    expect(s.alunosInscritos(aulaId, '2026-09-28')).toEqual([]); // outra data, outra sessao
  });
  it('recusa inscricao duplicada', () => {
    s.inscrever(aulaId, a1, SEG);
    expect(() => s.inscrever(aulaId, a1, SEG)).toThrow('já inscrito');
  });
  it('respeita o limite de vagas', () => {
    s.inscrever(aulaId, a1, SEG);
    s.inscrever(aulaId, a2, SEG);
    expect(() => s.inscrever(aulaId, a3, SEG)).toThrow('lotada');
  });
  it('recusa data em que a aula nao acontece', () => {
    expect(() => s.inscrever(aulaId, a1, '2026-09-22')).toThrow('não acontece');
  });
  it('doDia traz a ocupacao daquela data', () => {
    s.inscrever(aulaId, a1, SEG);
    const [aula] = s.doDia(SEG);
    expect(aula.inscritos).toBe(1);
    expect(aula.vagas).toBe(2);
  });
});
