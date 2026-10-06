import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoPlanos } from '../../src/servicos/planos.js';
import { aluno, plano, matricula } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let s: ReturnType<typeof criarServicoPlanos>;
let alunoId: number;

const HOJE = '2026-10-05';

beforeEach(() => {
  t = criarBancoDeTeste();
  s = criarServicoPlanos(t.db as any);
  alunoId = t.db.insert(aluno).values({ nome: 'Juliana', telefone: '+5511980002222' }).returning().get().id;
});
afterEach(() => t.fechar());

const novoPlano = (d: Partial<typeof plano.$inferInsert> = {}) =>
  t.db.insert(plano).values({
    nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1, ordem: 1, ...d,
  }).returning().get();

/** matricula em curso: e ela que trava a troca de tipo e a exclusao */
const matricularEm = (planoId: number, dataFim = '2026-11-05') =>
  t.db.insert(matricula).values({
    alunoId, planoId, dataInicio: '2026-10-05', dataFim, diaAncora: 5, valorCentavos: 9000,
  }).returning().get();

describe('listar', () => {
  it('fora do painel do dono mostra so os ativos, na ordem escolhida', () => {
    novoPlano({ nome: 'Trimestral', ordem: 2 });
    novoPlano({ nome: 'Mensal', ordem: 1 });
    novoPlano({ nome: 'Antigo', ordem: 3, ativo: false });
    expect(s.listar().map((p) => p.nome)).toEqual(['Mensal', 'Trimestral']);
  });

  it('o dono ve tambem os desativados, para poder reativar', () => {
    novoPlano({ nome: 'Mensal', ordem: 1 });
    novoPlano({ nome: 'Antigo', ordem: 2, ativo: false });
    expect(s.listar(true).map((p) => p.nome)).toEqual(['Mensal', 'Antigo']);
  });
});

describe('atualizar', () => {
  it('troca nome, preco e beneficios', () => {
    const p = novoPlano();
    const r = s.atualizar(p.id, {
      nome: 'Mensal Plus', precoCentavos: 13900, beneficios: ['Musculação', 'Avaliação'],
    });
    expect(r.nome).toBe('Mensal Plus');
    expect(r.precoCentavos).toBe(13900);
    expect(r.beneficios).toEqual(['Musculação', 'Avaliação']);
  });

  it('recusa nome vazio e preco que nao seja centavo inteiro positivo', () => {
    const p = novoPlano();
    expect(() => s.atualizar(p.id, { nome: '   ' })).toThrow('nome');
    expect(() => s.atualizar(p.id, { precoCentavos: 0 })).toThrow('Preço');
    expect(() => s.atualizar(p.id, { precoCentavos: 90.5 })).toThrow('Preço');
  });

  it('muda a duracao sem mexer em quem ja pagou', () => {
    const p = novoPlano({ duracaoMeses: 1 });
    const m = matricularEm(p.id);
    s.atualizar(p.id, { duracaoMeses: 3 });
    // o vencimento contratado continua o mesmo: a duracao nova vale da proxima vez
    const depois = t.db.select().from(matricula).all().find((x) => x.id === m.id)!;
    expect(depois.dataFim).toBe('2026-11-05');
    expect(s.listar()[0].duracaoMeses).toBe(3);
  });

  it('aceita duracao fora da lista pronta (2 meses, 15 dias)', () => {
    const mensal = novoPlano({ duracaoMeses: 1 });
    expect(s.atualizar(mensal.id, { duracaoMeses: 2 }).duracaoMeses).toBe(2);
    const diaria = novoPlano({ nome: 'Diária', duracaoMeses: 0, duracaoDias: 1, ordem: 2 });
    expect(s.atualizar(diaria.id, { duracaoDias: 15 }).duracaoDias).toBe(15);
  });

  it('recusa duracao sem sentido', () => {
    const p = novoPlano();
    expect(() => s.atualizar(p.id, { duracaoMeses: 0 })).toThrow('Duração');
    expect(() => s.atualizar(p.id, { duracaoMeses: 99 })).toThrow('Duração');
  });

  it('NAO deixa virar diaria enquanto houver matricula em curso', () => {
    const p = novoPlano({ duracaoMeses: 1 });
    matricularEm(p.id);
    expect(() => s.atualizar(p.id, { duracaoDias: 1 }, HOJE))
      .toThrow('matrícula em curso');
  });

  it('deixa virar diaria quando ninguem esta usando o plano', () => {
    const p = novoPlano({ duracaoMeses: 1 });
    matricularEm(p.id, '2026-09-01'); // vencida: nao esta em curso
    const r = s.atualizar(p.id, { duracaoDias: 3 }, HOJE);
    expect(r.duracaoDias).toBe(3);
    expect(r.duracaoMeses).toBe(0);
  });

  it('volta de diaria para mensalidade', () => {
    const p = novoPlano({ nome: 'Diária', duracaoMeses: 0, duracaoDias: 1 });
    const r = s.atualizar(p.id, { duracaoMeses: 1 }, HOJE);
    expect(r.duracaoDias).toBeNull();
    expect(r.duracaoMeses).toBe(1);
  });

  it('desativa e reativa', () => {
    const p = novoPlano();
    expect(s.atualizar(p.id, { ativo: false }).ativo).toBe(false);
    expect(s.listar()).toHaveLength(0);
    expect(s.atualizar(p.id, { ativo: true }).ativo).toBe(true);
    expect(s.listar()).toHaveLength(1);
  });

  it('reclama de plano que nao existe', () => {
    expect(() => s.atualizar(999, { nome: 'X' })).toThrow('não encontrado');
  });
});

describe('criar', () => {
  it('entra no fim da lista', () => {
    novoPlano({ ordem: 1 });
    const novo = s.criar({ nome: 'Diária', precoCentavos: 2500, duracaoMeses: 0, duracaoDias: 1 });
    expect(novo.ordem).toBe(2);
  });

  it('recusa dois planos com o mesmo nome', () => {
    s.criar({ nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1 });
    expect(() => s.criar({ nome: ' mensal ', precoCentavos: 9000, duracaoMeses: 1 }))
      .toThrow('Já existe');
  });
});

describe('excluir', () => {
  it('apaga de vez o plano que nunca foi usado', () => {
    const p = novoPlano({ nome: 'Criado por engano' });
    s.excluir(p.id);
    expect(s.listar(true)).toHaveLength(0);
  });

  it('NAO apaga plano com historico: manda desativar', () => {
    const p = novoPlano();
    matricularEm(p.id);
    expect(() => s.excluir(p.id)).toThrow('Desative');
    expect(s.listar(true)).toHaveLength(1); // nada foi perdido
  });
});

describe('reordenar', () => {
  it('grava a ordem na sequencia recebida', () => {
    const a = novoPlano({ nome: 'A', ordem: 1 });
    const b = novoPlano({ nome: 'B', ordem: 2 });
    const c = novoPlano({ nome: 'C', ordem: 3 });
    s.reordenar([c.id, a.id, b.id]);
    expect(s.listar().map((p) => p.nome)).toEqual(['C', 'A', 'B']);
  });

  it('recusa lista com id que nao existe e nao grava nada pela metade', () => {
    const a = novoPlano({ nome: 'A', ordem: 1 });
    const b = novoPlano({ nome: 'B', ordem: 2 });
    expect(() => s.reordenar([b.id, 999, a.id])).toThrow('não encontrado');
    expect(s.listar().map((p) => p.nome)).toEqual(['A', 'B']);
  });
});

describe('reordenar: quem ficou fora da lista', () => {
  it('vai para o fim em vez de brigar pela mesma posicao', () => {
    const a = novoPlano({ nome: 'A', ordem: 1 });
    const b = novoPlano({ nome: 'B', ordem: 2 });
    const c = novoPlano({ nome: 'C', ordem: 3 });
    s.reordenar([c.id, a.id]); // B nao foi enviado
    expect(s.listar().map((p) => p.nome)).toEqual(['C', 'A', 'B']);
    expect(s.listar().map((p) => p.ordem)).toEqual([1, 2, 3]);
  });
});

describe('plano sem prazo nenhum', () => {
  it('recusa tirar a diaria sem dizer quantos meses passa a valer', () => {
    const p = novoPlano({ nome: 'Diária', duracaoMeses: 0, duracaoDias: 1 });
    // sem isso o plano ficaria com 0 mes e 0 dia: a renovacao nao teria o que somar
    expect(() => s.atualizar(p.id, { duracaoDias: null }, HOJE)).toThrow('Duração');
    expect(s.listar()[0].duracaoDias).toBe(1); // nada mudou
  });
});
