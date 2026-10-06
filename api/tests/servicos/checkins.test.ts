import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoCheckins } from '../../src/servicos/checkins.js';
import { aluno } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let s: ReturnType<typeof criarServicoCheckins>;
let alunoId: number;

beforeEach(() => {
  t = criarBancoDeTeste();
  s = criarServicoCheckins(t.db as any);
  alunoId = t.db.insert(aluno).values({ nome: 'Rafael', telefone: '+5511980001111' }).returning().get().id;
});
afterEach(() => t.fechar());

describe('checkins', () => {
  it('REGRESSAO: check-in as 21:30 de SP conta no dia de SP, nao no dia UTC', () => {
    const c = s.registrar({ alunoId, atividade: 'Musculacao', agora: new Date('2026-09-21T21:30:00-03:00') });
    expect(c.dataHora).toBe('2026-09-22T00:30:00.000Z'); // UTC ja virou o dia
    expect(c.dataLocal).toBe('2026-09-21');              // mas o dia da academia nao
    expect(s.doDia('2026-09-21')).toHaveLength(1);
    expect(s.doDia('2026-09-22')).toHaveLength(0);
  });

  it('REGRESSAO: ultimo dia do mes a noite conta no mes certo', () => {
    s.registrar({ alunoId, atividade: 'Cardio', agora: new Date('2026-09-30T22:15:00-03:00') });
    expect(s.contagemNoMes(alunoId, '2026-09')).toBe(1);
    expect(s.contagemNoMes(alunoId, '2026-10')).toBe(0);
  });

  it('recusa aluno inexistente', () => {
    expect(() => s.registrar({ alunoId: 999, atividade: 'X' })).toThrow('Aluno não encontrado');
  });

  it('apertar o botao duas vezes nao registra duas entradas', () => {
    const agora = new Date('2026-09-10T08:00:00-03:00');
    s.registrar({ alunoId, atividade: 'Musculacao', agora });
    expect(() => s.registrar({ alunoId, atividade: 'Musculacao', agora })).toThrow(/60 minutos/);
    expect(s.doAluno(alunoId)).toHaveLength(1);
  });

  it('a mensagem diz quanto falta para o proximo', () => {
    s.registrar({ alunoId, atividade: 'Musculacao', agora: new Date('2026-09-10T08:00:00-03:00') });
    expect(() => s.registrar({ alunoId, atividade: 'Cardio', agora: new Date('2026-09-10T08:45:00-03:00') }))
      .toThrow(/15 minutos/);
  });

  it('passada uma hora, a segunda entrada do dia e aceita', () => {
    s.registrar({ alunoId, atividade: 'Musculacao', agora: new Date('2026-09-10T08:00:00-03:00') });
    s.registrar({ alunoId, atividade: 'Cardio', agora: new Date('2026-09-10T19:00:00-03:00') });
    expect(s.doAluno(alunoId)).toHaveLength(2);
    expect(s.contagemNoMes(alunoId, '2026-09')).toBe(2);
  });

  it('o intervalo e por aluno: um nao segura o outro', () => {
    const outro = t.db.insert(aluno).values({ nome: 'Bia', telefone: '+5511980002222' }).returning().get().id;
    const agora = new Date('2026-09-10T08:00:00-03:00');
    s.registrar({ alunoId, atividade: 'Musculacao', agora });
    s.registrar({ alunoId: outro, atividade: 'Musculacao', agora });
    expect(s.doDia('2026-09-10')).toHaveLength(2);
  });

  it('ultimoDe devolve o mais recente', () => {
    s.registrar({ alunoId, atividade: 'A', agora: new Date('2026-09-10T08:00:00-03:00') });
    s.registrar({ alunoId, atividade: 'B', agora: new Date('2026-09-12T08:00:00-03:00') });
    expect(s.ultimoDe(alunoId)?.atividade).toBe('B');
  });
});
