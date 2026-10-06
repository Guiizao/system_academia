import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoFinanceiro } from '../../src/servicos/financeiro.js';
import { criarServicoAlunos } from '../../src/servicos/alunos.js';
import { aluno, plano, academia, matricula, cobranca } from '../../src/db/schema.js';

// Instalacao real: ninguem grava cobranca a mao. Ela nasce quando o plano entra
// na janela de aviso -- sem isso, inadimplencia e "cobranca vencida" ficam zerados.
const H = '2026-09-20';
let t: ReturnType<typeof criarBancoDeTeste>;
let fin: ReturnType<typeof criarServicoFinanceiro>;
let planoId: number;

const novoAluno = (nome: string) =>
  t.db.insert(aluno).values({ nome, telefone: '+55119800' + String(Math.random()).slice(2, 7) }).returning().get().id;
const matriculaAte = (alunoId: number, dataFim: string) =>
  t.db.insert(matricula).values({
    alunoId, planoId, dataInicio: '2026-08-01', dataFim, diaAncora: Number(dataFim.slice(8)), valorCentavos: 12900,
  }).returning().get();
const abertas = () => fin.cobrancasAbertas(H);

beforeEach(() => {
  t = criarBancoDeTeste();
  fin = criarServicoFinanceiro(t.db as any);
  t.db.insert(academia).values({ nome: 'DARK FISIC', diasAvisoVencimento: 5 }).run();
  planoId = t.db.insert(plano).values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning().get().id;
});
afterEach(() => t.fechar());

describe('cobranca automatica', () => {
  it('nasce quando o plano entra na janela de aviso, com o preco atual do plano', () => {
    const m = matriculaAte(novoAluno('Ana'), '2026-09-23');
    const [c] = abertas();
    expect(c).toMatchObject({ vencimento: '2026-09-23', valorCentavos: 13900, competencia: '2026-09' });
    expect(t.db.select().from(cobranca).get()!.matriculaId).toBe(m.id);
  });
  it('nao nasce antes da janela', () => {
    matriculaAte(novoAluno('Bia'), '2026-10-10');
    expect(abertas()).toHaveLength(0);
  });
  it('plano ja vencido tambem gera, e entra na inadimplencia', () => {
    matriculaAte(novoAluno('Caio'), '2026-09-12');
    expect(fin.inadimplencia(H)).toBe(13900);
  });
  it('consultar de novo nao duplica', () => {
    matriculaAte(novoAluno('Duda'), '2026-09-22');
    abertas(); abertas(); fin.inadimplencia(H);
    expect(t.db.select().from(cobranca).all()).toHaveLength(1);
  });
  it('aluno desativado nao ganha cobranca nova', () => {
    const id = novoAluno('Edu');
    t.db.update(aluno).set({ ativo: false }).where(eq(aluno.id, id)).run();
    matriculaAte(id, '2026-09-22');
    expect(abertas()).toHaveLength(0);
  });
  it('desativar o aluno cancela o que estava em aberto', () => {
    const id = novoAluno('Fabi');
    matriculaAte(id, '2026-09-10');
    expect(abertas()).toHaveLength(1);
    criarServicoAlunos(t.db as any).atualizar(id, { ativo: false });
    expect(abertas()).toHaveLength(0);
    expect(fin.inadimplencia(H)).toBe(0);
  });
  it('renovar pelo pagamento avulso quita a cobranca do periodo anterior', () => {
    const id = novoAluno('Gil');
    matriculaAte(id, '2026-09-22');
    expect(abertas()).toHaveLength(1);
    fin.registrarPagamento({ alunoId: id, valorCentavos: 13900, forma: 'dinheiro', planoId, dataPagamento: H });
    expect(abertas()).toHaveLength(0);
    expect(t.db.select().from(cobranca).get()!.status).toBe('paga');
  });
  it('depois de renovar, a proxima cobranca so nasce na proxima janela', () => {
    const id = novoAluno('Hugo');
    const c = (matriculaAte(id, '2026-09-22'), abertas()[0]);
    fin.registrarPagamento({ alunoId: id, valorCentavos: 13900, forma: 'pix', cobrancaId: c.id, planoId, dataPagamento: H });
    expect(abertas()).toHaveLength(0);                  // novo fim: 22/10, fora da janela
    expect(fin.cobrancasAbertas('2026-10-18')).toHaveLength(1);
  });
});
