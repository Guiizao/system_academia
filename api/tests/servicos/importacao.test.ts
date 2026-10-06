import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { criarBancoDeTeste } from '../helpers/db.js';
import { importarAlunos, importarDaPasta } from '../../src/servicos/importacao.js';
import { configurarPrimeiroAcesso } from '../../src/servicos/primeiro-acesso.js';
import { aluno, plano, matricula, pagamento } from '../../src/db/schema.js';
import type { ArquivoImportacao } from '../../src/importacao/formato.js';

let t: ReturnType<typeof criarBancoDeTeste>;
beforeEach(() => { t = criarBancoDeTeste(); });
afterEach(() => t.fechar());

const arquivo = (alunos: ArquivoImportacao['alunos']): ArquivoImportacao => ({
  formato: 'darkfisic-importacao', versao: 1,
  planos: [
    { nome: 'Mensal', precoCentavos: 9000, duracaoMeses: 1 },
    { nome: 'Mensal com personal (R$ 75)', precoCentavos: 7500, duracaoMeses: 1 },
  ],
  alunos,
});
const ANA = {
  nome: 'Ana Lima', telefone: '+5514991110000', aceitaWhatsapp: true, plano: 'Mensal',
  matricula: { dataInicio: '2026-09-01', dataFim: '2026-10-01' },
  pagamentos: [{ data: '2026-09-01', valorCentavos: 9000, forma: 'pix' as const }],
};
const CAIO = {
  nome: 'Caio Reis', telefone: null, aceitaWhatsapp: false, plano: 'Mensal com personal (R$ 75)',
  matricula: { dataInicio: '2026-08-10', dataFim: '2026-09-10' }, pagamentos: [],
};
const SEM_MATRICULA = { nome: 'Fabi Moura', telefone: null, aceitaWhatsapp: false, plano: null, matricula: null, pagamentos: [] };

describe('importarAlunos', () => {
  it('grava alunos, planos, matriculas e pagamentos', () => {
    const r = importarAlunos(t.db as any, arquivo([ANA, CAIO, SEM_MATRICULA]));
    expect(r).toMatchObject({ alunosCriados: 3, planosCriados: 2, matriculas: 2, pagamentos: 1, ignorados: [] });

    const ana = t.db.select().from(aluno).all().find((a) => a.nome === 'Ana Lima')!;
    expect(ana).toMatchObject({ telefone: '+5514991110000', aceitaWhatsapp: true, ativo: true });
    const caio = t.db.select().from(aluno).all().find((a) => a.nome === 'Caio Reis')!;
    expect(caio.telefone).toBe('');  // sem telefone: a recepcao completa depois

    const mats = t.db.select().from(matricula).all();
    const mCaio = mats.find((m) => m.alunoId === caio.id)!;
    expect(mCaio).toMatchObject({ dataFim: '2026-09-10', diaAncora: 10, valorCentavos: 7500, status: 'ativa' });

    const [p] = t.db.select().from(pagamento).all();
    expect(p).toMatchObject({ alunoId: ana.id, valorCentavos: 9000, forma: 'pix', dataPagamento: '2026-09-01' });
    expect(p.observacao).toContain('planilha');
  });

  it('importar de novo nao duplica nada', () => {
    importarAlunos(t.db as any, arquivo([ANA, CAIO]));
    const r = importarAlunos(t.db as any, arquivo([ANA, CAIO]));
    expect(r).toMatchObject({ alunosCriados: 0, planosCriados: 0, pagamentos: 0 });
    expect(r.ignorados).toEqual(['Ana Lima', 'Caio Reis']);
    expect(t.db.select().from(aluno).all()).toHaveLength(2);
    expect(t.db.select().from(plano).all()).toHaveLength(2);
  });

  it('aluno ja cadastrado com o mesmo nome (sem acento, espaco a mais) e pulado', () => {
    t.db.insert(aluno).values({ nome: 'ANA  LIMA', telefone: '+5511900000000' }).run();
    const r = importarAlunos(t.db as any, arquivo([ANA, { ...ANA, nome: 'Ána  Lima' }]));
    expect(r.alunosCriados).toBe(0);
    expect(r.ignorados).toEqual(['Ana Lima', 'Ána  Lima']);
  });

  it('telefone repetido (familia que divide o numero) nao faz ninguem sumir', () => {
    const filha = { ...ANA, nome: 'Bia Lima', pagamentos: [] };
    const r = importarAlunos(t.db as any, arquivo([ANA, filha]));
    expect(r.alunosCriados).toBe(2);
    expect(r.ignorados).toEqual([]);
  });

  it('reaproveita plano que ja existe com o mesmo nome e preco', () => {
    t.db.insert(plano).values({ nome: 'mensal', precoCentavos: 9000, duracaoMeses: 1 }).run();
    const r = importarAlunos(t.db as any, arquivo([ANA]));
    expect(r.planosCriados).toBe(1);  // so o "com personal"
    expect(t.db.select().from(plano).all()).toHaveLength(2);
  });

  it('recusa arquivo fora do formato sem gravar nada', () => {
    expect(() => importarAlunos(t.db as any, { formato: 'outro' })).toThrow();
    const ruim = arquivo([{ ...ANA, plano: 'Plano que nao existe' }]);
    expect(() => importarAlunos(t.db as any, ruim)).toThrow('Plano que nao existe');
    expect(t.db.select().from(aluno).all()).toHaveLength(0);
  });
});

describe('importarDaPasta', () => {
  let pasta: string;
  const backups: string[] = [];
  const opcoes = () => ({ fazerBackup: () => { backups.push('ok'); return 'copia.db'; } });
  beforeEach(() => { pasta = mkdtempSync(join(tmpdir(), 'df-importar-')); backups.length = 0; });
  afterEach(() => rmSync(pasta, { recursive: true, force: true }));
  const dono = () => configurarPrimeiroAcesso(t.db as any, {
    nomeAcademia: 'Academia Teste', nome: 'Dono', email: 'dono@teste.com', senha: 'senha-longa-123',
  });

  it('sem arquivos: nao faz nada', () => {
    expect(importarDaPasta(t.db as any, pasta, opcoes())).toEqual([]);
    expect(backups).toHaveLength(0);
  });

  it('espera a conta do dono antes de importar', () => {
    writeFileSync(join(pasta, 'alunos.json'), JSON.stringify(arquivo([ANA])));
    const [r] = importarDaPasta(t.db as any, pasta, opcoes());
    expect(r).toMatchObject({ arquivo: 'alunos.json', situacao: 'aguardando' });
    expect(readdirSync(pasta)).toEqual(['alunos.json']);
  });

  it('faz backup, importa e renomeia o arquivo para .importado', async () => {
    await dono();
    writeFileSync(join(pasta, 'alunos.json'), JSON.stringify(arquivo([ANA, CAIO])));
    const [r] = importarDaPasta(t.db as any, pasta, opcoes());
    expect(r).toMatchObject({ situacao: 'importado', resumo: { alunosCriados: 2 } });
    expect(backups).toHaveLength(1);
    expect(readdirSync(pasta)).toEqual(['alunos.json.importado']);
  });

  it('um arquivo com problema nao impede os outros de entrar', async () => {
    await dono();
    writeFileSync(join(pasta, '1-quebrado.json'), '{ isto nao e json');
    writeFileSync(join(pasta, '2-bom.json'), JSON.stringify(arquivo([ANA])));
    const r = importarDaPasta(t.db as any, pasta, opcoes());
    expect(r.map((x) => x.situacao)).toEqual(['erro', 'importado']);
    expect(t.db.select().from(aluno).all()).toHaveLength(1);
  });

  it('arquivo com erro vira .erro, com o motivo ao lado, e nao grava nada', async () => {
    await dono();
    writeFileSync(join(pasta, 'quebrado.json'), '{ isto nao e json');
    const [r] = importarDaPasta(t.db as any, pasta, opcoes());
    expect(r.situacao).toBe('erro');
    expect(readdirSync(pasta).sort()).toEqual(['quebrado.json.erro', 'quebrado.json.motivo.txt']);
    expect(readFileSync(join(pasta, 'quebrado.json.motivo.txt'), 'utf8')).toMatch(/JSON/i);
    expect(t.db.select().from(aluno).all()).toHaveLength(0);
  });
});
