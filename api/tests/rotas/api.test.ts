import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarBancoDeTeste } from '../helpers/db.js';
import { construirServidor } from '../../src/servidor.js';
import { hashSenha } from '../../src/servicos/auth.js';
import { usuario, plano, academia, exercicio, aluno } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let alunoId: number, planoId: number, exId: number;

async function entrar(email: string) {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha: 'senha-teste-1' } });
  expect(r.statusCode).toBe(200);
  return `df_sessao=${r.cookies.find((c) => c.name === 'df_sessao')!.value}`;
}
const como = (quem: string, method: any, url: string, payload?: any) =>
  app.inject({ method, url, payload, headers: { cookie: cookies[quem] } });

beforeAll(async () => {
  t = criarBancoDeTeste();
  const h = await hashSenha('senha-teste-1');
  t.db.insert(academia).values({ nome: 'DARK FISIC', pixChave: 'df@x.com', pixNomeRecebedor: 'DARK FISIC', pixCidade: 'SAO PAULO' }).run();
  t.db.insert(usuario).values([
    { nome: 'Joao', email: 'dono@df', papel: 'dono', senhaHash: h },
    { nome: 'Bruna', email: 'rec@df', papel: 'recepcao', senhaHash: h },
    { nome: 'Pedro', email: 'prof@df', papel: 'professor', senhaHash: h, cref: '123456-G/SP' },
  ]).run();
  planoId = t.db.insert(plano).values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning().get().id;
  exId = t.db.insert(exercicio).values({ nome: 'Leg press', grupoMuscular: 'pernas', padraoMovimento: 'agachar', equipamento: 'Leg Press', nivelMinimo: 'iniciante' }).returning().get().id;
  alunoId = t.db.insert(aluno).values({ nome: 'Rafael', telefone: '+5511980001111' }).returning().get().id;

  app = construirServidor({ db: t.db as any });
  await app.ready();
  cookies.dono = await entrar('dono@df');
  cookies.rec = await entrar('rec@df');
  cookies.prof = await entrar('prof@df');
});
afterAll(async () => { await app.close(); t.fechar(); });

describe('autenticacao', () => {
  it('sem login: 401 em toda rota /api', async () => {
    for (const url of ['/api/alunos', '/api/dashboard', '/api/pagamentos', '/api/fichas']) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    }
  });
  it('senha errada: 401 com mensagem neutra', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dono@df', senha: 'x' } });
    expect(r.statusCode).toBe(401);
    expect(r.json().erro).toBe('E-mail ou senha incorretos');
  });
  it('cookie de sessao e httpOnly', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'prof@df', senha: 'senha-teste-1' } });
    expect(r.cookies.find((c) => c.name === 'df_sessao')!.httpOnly).toBe(true);
  });
});

describe('matriz de permissoes (spec 5.6)', () => {
  it('recepcao NAO recebe o financeiro consolidado do dashboard', async () => {
    const dono = (await como('dono', 'GET', '/api/dashboard')).json();
    const rec = (await como('rec', 'GET', '/api/dashboard')).json();
    expect(dono).toHaveProperty('receitaMesCentavos');
    expect(rec).not.toHaveProperty('receitaMesCentavos');
    expect(rec).not.toHaveProperty('inadimplenciaCentavos');
    expect(rec).toHaveProperty('ativos');
  });
  it('professor nao registra pagamento', async () => {
    const r = await como('prof', 'POST', '/api/pagamentos', { alunoId, valorCentavos: 13900, forma: 'pix' });
    expect(r.statusCode).toBe(403);
  });
  it('recepcao nao monta ficha, mas libera', async () => {
    const criar = await como('rec', 'POST', '/api/fichas', {
      alunoId, objetivo: 'hipertrofia', nivel: 'iniciante', diasPorSemana: 3,
      divisoes: [{ rotulo: 'A', foco: 'Pernas', itens: [{ exercicioId: exId, series: 3, reps: '12', descansoSeg: 60 }] }],
    });
    expect(criar.statusCode).toBe(403);
  });
  it('so o dono altera preco de plano', async () => {
    expect((await como('rec', 'PUT', `/api/planos/${planoId}`, { precoCentavos: 1 })).statusCode).toBe(403);
    expect((await como('dono', 'PUT', `/api/planos/${planoId}`, { precoCentavos: 14900 })).statusCode).toBe(200);
  });
  it('pix avulso: recepcao gera, professor nao, valor quebrado da 400', async () => {
    const r = await como('rec', 'GET', '/api/pix?valor=13900');
    expect(r.statusCode).toBe(200);
    expect(r.json().payload).toContain('5406139.00');
    expect((await como('prof', 'GET', '/api/pix?valor=13900')).statusCode).toBe(403);
    expect((await como('rec', 'GET', '/api/pix?valor=abc')).statusCode).toBe(400);
  });
});

describe('fluxos', () => {
  it('cadastro exige consentimento LGPD', async () => {
    const r = await como('rec', 'POST', '/api/alunos', { nome: 'Ana', telefone: '11980006666', consentimentoLgpd: false });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toMatch(/LGPD/);
  });
  it('cadastro com plano ja matricula e normaliza telefone', async () => {
    const r = await como('rec', 'POST', '/api/alunos', {
      nome: 'Ana Costa', telefone: '(11) 9 8000-6666', consentimentoLgpd: true, planoId, formaPagamento: 'pix',
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().telefone).toBe('+5511980006666');
    expect(r.json().status).toBe('ativo');
  });
  it('entrada invalida vira 400 legivel, nao 500', async () => {
    const r = await como('rec', 'POST', '/api/pagamentos', { alunoId, valorCentavos: 139.5, forma: 'pix' });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toMatch(/valorCentavos/);
  });
  it('check-in registra e aparece no dashboard', async () => {
    expect((await como('rec', 'POST', '/api/checkins', { alunoId, atividade: 'Musculacao' })).statusCode).toBe(201);
    expect((await como('rec', 'GET', '/api/dashboard')).json().checkinsHoje).toBeGreaterThanOrEqual(1);
  });
  it('ficha: qualquer papel logado libera; o CREF so entra na assinatura', async () => {
    const nova = async () => (await como('prof', 'POST', '/api/fichas', {
      alunoId, objetivo: 'hipertrofia', nivel: 'iniciante', diasPorSemana: 3,
      divisoes: [{ rotulo: 'A', foco: 'Pernas', itens: [{ exercicioId: exId, series: 3, reps: '12', descansoSeg: 60 }] }],
    })).json();

    const comCref = await como('prof', 'POST', `/api/fichas/${(await nova()).id}/aprovar`);
    expect(comCref.statusCode).toBe(200);
    expect(comCref.json().aprovadaCref).toBe('123456-G/SP');

    const semCref = await como('dono', 'POST', `/api/fichas/${(await nova()).id}/aprovar`);
    expect(semCref.statusCode).toBe(200);
    expect(semCref.json().aprovadaCref).toBeNull();

    const rec = await como('rec', 'POST', `/api/fichas/${(await nova()).id}/aprovar`);
    expect(rec.statusCode).toBe(200);
    expect(rec.json().aprovadaCref).toBeNull();
  });
  it('IA desativada: gerar ficha responde 503', async () => {
    const r = await como('prof', 'POST', '/api/fichas/gerar');
    expect(r.statusCode).toBe(503);
    expect(r.json().erro).toMatch(/desativada/);
  });
});

describe('planos e relatorio', () => {
  it('o dono cria um plano novo', async () => {
    const r = await como('dono', 'POST', '/api/planos', { nome: 'Mensal com personal', precoCentavos: 7500, duracaoMeses: 1 });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ nome: 'Mensal com personal', precoCentavos: 7500, ativo: true });
  });

  it('o dono muda o nome e o preco', async () => {
    const r = await como('dono', 'PUT', `/api/planos/${planoId}`, { nome: 'Mensal', precoCentavos: 9000 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ nome: 'Mensal', precoCentavos: 9000 });
  });

  it('plano desativado sai da lista de venda', async () => {
    const criado = (await como('dono', 'POST', '/api/planos', { nome: 'Para apagar', precoCentavos: 1000, duracaoMeses: 1 })).json();
    await como('dono', 'PUT', `/api/planos/${criado.id}`, { ativo: false });
    const lista = (await como('rec', 'GET', '/api/planos')).json();
    expect(lista.some((p: any) => p.id === criado.id)).toBe(false);
  });

  it('recepcao nao mexe em plano nem ve relatorio', async () => {
    expect((await como('rec', 'POST', '/api/planos', { nome: 'X', precoCentavos: 100, duracaoMeses: 1 })).statusCode).toBe(403);
    expect((await como('rec', 'GET', '/api/relatorios/financeiro')).statusCode).toBe(403);
    expect((await como('prof', 'GET', '/api/relatorios/financeiro')).statusCode).toBe(403);
  });

  it('relatorio traz os numeros e o texto pronto para o WhatsApp', async () => {
    const r = await como('dono', 'GET', '/api/relatorios/financeiro?mes=2026-10');
    expect(r.statusCode).toBe(200);
    const c = r.json();
    expect(c).toMatchObject({ mes: '2026-10', academia: 'DARK FISIC' });
    expect(c.serie).toHaveLength(6);
    expect(c.texto).toContain('DARK FISIC');
  });

  it('mes fora do formato e 400', async () => {
    expect((await como('dono', 'GET', '/api/relatorios/financeiro?mes=outubro')).statusCode).toBe(400);
  });
});

describe('diaria e vencimento manual', () => {
  let diariaId: number;

  it('o dono cria o plano de diaria', async () => {
    const r = await como('dono', 'POST', '/api/planos', {
      nome: 'Diária', precoCentavos: 2500, duracaoMeses: 0, duracaoDias: 1,
    });
    expect(r.statusCode).toBe(201);
    diariaId = r.json().id;
    expect(r.json()).toMatchObject({ duracaoDias: 1, duracaoMeses: 0 });
  });

  it('pagar a diaria vale so aquele dia', async () => {
    const r = await como('rec', 'POST', '/api/pagamentos', {
      alunoId, valorCentavos: 2500, forma: 'dinheiro', planoId: diariaId, dataPagamento: '2026-10-05',
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().matricula).toMatchObject({ dataInicio: '2026-10-05', dataFim: '2026-10-05' });
  });

  it('a pessoa paga hoje e marca o dia que vem', async () => {
    const r = await como('rec', 'POST', '/api/pagamentos', {
      alunoId, valorCentavos: 2500, forma: 'pix', planoId: diariaId,
      dataPagamento: '2026-10-05', dataInicioEscolhida: '2026-10-20',
    });
    expect(r.json().matricula).toMatchObject({ dataInicio: '2026-10-20', dataFim: '2026-10-20' });
  });

  it('tres diarias valem tres dias', async () => {
    const tres = (await como('dono', 'POST', '/api/planos', {
      nome: '3 diárias', precoCentavos: 6000, duracaoMeses: 0, duracaoDias: 3,
    })).json();
    const r = await como('rec', 'POST', '/api/pagamentos', {
      alunoId, valorCentavos: 6000, forma: 'dinheiro', planoId: tres.id, dataPagamento: '2026-10-05',
    });
    expect(r.json().matricula.dataFim).toBe('2026-10-07');
  });

  it('a recepcao pode definir o vencimento na mao', async () => {
    const r = await como('rec', 'POST', '/api/pagamentos', {
      alunoId, valorCentavos: 9000, forma: 'dinheiro', planoId,
      dataPagamento: '2026-10-05', dataFimManual: '2026-11-25',
    });
    expect(r.json().matricula).toMatchObject({ dataFim: '2026-11-25', diaAncora: 25 });
  });

  it('vencimento antes do inicio e recusado', async () => {
    const r = await como('rec', 'POST', '/api/pagamentos', {
      alunoId, valorCentavos: 9000, forma: 'dinheiro', planoId,
      dataPagamento: '2026-10-05', dataFimManual: '2026-09-01',
    });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('diaria nao gera cobranca automatica do mes seguinte', async () => {
    const visitante = t.db.insert(aluno).values({ nome: 'Visitante', telefone: '+5514990009999' }).returning().get();
    await como('rec', 'POST', '/api/pagamentos', {
      alunoId: visitante.id, valorCentavos: 2500, forma: 'dinheiro', planoId: diariaId,
    });
    const cobrancas = (await como('rec', 'GET', '/api/cobrancas')).json();
    expect(cobrancas.some((c: any) => c.alunoId === visitante.id)).toBe(false);
  });
});

describe('erros do cliente', () => {
  it('JSON malformado e 400, nao 500', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/checkins', payload: '{"alunoId": 1, "atividade": ',
      headers: { cookie: cookies.rec, 'content-type': 'application/json' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toBeTruthy();
  });
});


describe('planos: edicao completa, so pelo dono', () => {
  it('recepcao e professor nao criam, editam, reordenam nem excluem', async () => {
    for (const quem of ['rec', 'prof']) {
      expect((await como(quem, 'POST', '/api/planos',
        { nome: 'X', precoCentavos: 100, duracaoMeses: 1 })).statusCode).toBe(403);
      expect((await como(quem, 'PUT', `/api/planos/${planoId}`, { precoCentavos: 1 })).statusCode).toBe(403);
      expect((await como(quem, 'POST', '/api/planos/ordem', { ids: [planoId] })).statusCode).toBe(403);
      expect((await como(quem, 'DELETE', `/api/planos/${planoId}`)).statusCode).toBe(403);
    }
  });

  it('a lista com desativados e so do dono', async () => {
    const novo = (await como('dono', 'POST', '/api/planos',
      { nome: 'Fora de linha', precoCentavos: 5000, duracaoMeses: 1 })).json();
    await como('dono', 'PUT', `/api/planos/${novo.id}`, { ativo: false });

    const nomes = (r: any) => r.json().map((p: any) => p.nome);
    expect(nomes(await como('dono', 'GET', '/api/planos?todos=1'))).toContain('Fora de linha');
    // recepcao pede todos=1 e recebe apenas os ativos
    expect(nomes(await como('rec', 'GET', '/api/planos?todos=1'))).not.toContain('Fora de linha');
    expect(nomes(await como('dono', 'GET', '/api/planos'))).not.toContain('Fora de linha');

    // reativar devolve para a lista de venda
    await como('dono', 'PUT', `/api/planos/${novo.id}`, { ativo: true });
    expect(nomes(await como('dono', 'GET', '/api/planos'))).toContain('Fora de linha');
    await como('dono', 'DELETE', `/api/planos/${novo.id}`);
  });

  it('dono muda nome, preco, duracao e ordem', async () => {
    const r = await como('dono', 'PUT', `/api/planos/${planoId}`,
      { nome: 'Plus 2026', precoCentavos: 15000, duracaoMeses: 2 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ nome: 'Plus 2026', precoCentavos: 15000, duracaoMeses: 2 });

    const extra = (await como('dono', 'POST', '/api/planos',
      { nome: 'Semestral', precoCentavos: 48000, duracaoMeses: 6 })).json();
    const ordenado = await como('dono', 'POST', '/api/planos/ordem', { ids: [extra.id, planoId] });
    expect(ordenado.json().map((p: any) => p.id).slice(0, 2)).toEqual([extra.id, planoId]);
    await como('dono', 'DELETE', `/api/planos/${extra.id}`);
  });

  it('plano com matricula nao e apagado: a resposta manda desativar', async () => {
    await como('dono', 'POST', '/api/pagamentos',
      { alunoId, valorCentavos: 15000, forma: 'pix', planoId });
    const r = await como('dono', 'DELETE', `/api/planos/${planoId}`);
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toContain('Desative');
    // e continua existindo
    expect((await como('dono', 'GET', '/api/planos')).json().some((p: any) => p.id === planoId)).toBe(true);
  });
});

describe('login: limite de tentativas (antes de expor pelo tunel)', () => {
  const tentar = (de: string, headers: Record<string, string> = {}, email = 'naoexiste@df') =>
    app.inject({ method: 'POST', url: '/api/auth/login', headers, remoteAddress: de,
                 payload: { email, senha: 'errada' } });

  it('depois de 10 tentativas do mesmo aparelho, responde 429 com Retry-After', async () => {
    let ultima;
    for (let i = 0; i < 11; i++) ultima = await tentar('192.168.0.10');
    expect(ultima!.statusCode).toBe(429);
    expect(Number(ultima!.headers['retry-after'])).toBeGreaterThan(0);
    expect(ultima!.json().erro).toMatch(/Muitas tentativas/);
  });

  it('na rede da academia, forjar X-Forwarded-For nao zera a contagem', async () => {
    // quem chega pela Wi-Fi nao e proxy de confianca: o cabecalho e ignorado e
    // vale o IP real. Sem isso bastaria trocar o IP falso a cada tentativa.
    for (let i = 0; i < 10; i++) await tentar('192.168.0.20');
    const r = await tentar('192.168.0.20', { 'x-forwarded-for': `203.0.113.${Date.now() % 250}` });
    expect(r.statusCode).toBe(429);
  });

  it('pelo tunel, cada visitante tem a propria cota', async () => {
    // o tunel entrega em 127.0.0.1 e informa quem chamou no X-Forwarded-For.
    // Um visitante castigado nao pode derrubar o login dos outros.
    for (let i = 0; i < 10; i++) await tentar('127.0.0.1', { 'x-forwarded-for': '198.51.100.9' });
    expect((await tentar('127.0.0.1', { 'x-forwarded-for': '198.51.100.9' })).statusCode).toBe(429);
    expect((await tentar('127.0.0.1', { 'x-forwarded-for': '198.51.100.10' })).statusCode).toBe(401);
  });

  it('varrer senhas trocando o e-mail tambem esbarra no limite', async () => {
    for (let i = 0; i < 10; i++) await tentar('192.168.0.30', {}, `alvo${i}@df`);
    const r = await tentar('192.168.0.30', {}, 'maisum@df');
    expect(r.statusCode).toBe(429); // o limite e por aparelho, nao por e-mail
  });
});
