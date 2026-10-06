# Backend: Fundação e Domínio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a API testada do núcleo financeiro e cadastral da DARK FISIC — alunos, avaliações, planos, matrículas com renovação correta, cobranças e Pix.

**Architecture:** Monólito Node/TypeScript. Fastify serve a API; `better-sqlite3` acessa um arquivo SQLite; Drizzle define o schema em TypeScript e infere os tipos, que são compartilhados com o frontend. Regras de negócio vivem numa camada de serviços chamada pelas rotas — nunca dentro dos handlers HTTP.

**Tech Stack:** Node 20+, TypeScript, Fastify, Drizzle ORM, better-sqlite3, Zod, Vitest, argon2.

**Spec:** `docs/superpowers/specs/2026-09-08-sistema-academia-nucleo-design.md`

## Global Constraints

- Dinheiro: **inteiro em centavos**. Nunca float, nunca `number` com decimais.
- Telefone: **E.164** (`+5511980001111`).
- Datas: **UTC no banco**, `America/Sao_Paulo` na apresentação. Datas de calendário (vencimento, início) são armazenadas como `TEXT` no formato `YYYY-MM-DD`, sem hora, para não sofrerem deslocamento de fuso.
- Toda tabela tem `id`, `criado_em`, `atualizado_em`.
- **Nenhuma regra de negócio em handler HTTP.** Rotas só validam entrada, chamam serviço e serializam saída.
- Status de aluno é **derivado**, nunca armazenado.
- Toda entrada de API validada com Zod antes de chegar ao serviço.
- Node 20+ (necessário para `node:test` runner opcional e `better-sqlite3` pré-compilado).
- Idioma do código: identificadores em português quando nomeiam conceito de domínio (`matricula`, `cobranca`), inglês para termos técnicos (`repository`, `service`).

---

## File Structure

```
academia/
  package.json
  tsconfig.json
  vitest.config.ts
  drizzle.config.ts
  .env.example
  src/
    db/
      schema.ts            definição Drizzle de todas as tabelas
      client.ts            abre o SQLite, aplica PRAGMAs
      migrate.ts           roda migrations na subida
      seed.ts              dados iniciais (academia, planos, tags)
    dominio/
      dinheiro.ts          centavos <-> reais, formatação
      telefone.ts          normalização E.164
      datas.ts             adicionarMeses com âncora, hoje(), diffDias
      status.ts            statusDoAluno derivado
      pix.ts               montagem do BR Code (EMV)
    servicos/
      alunos.ts
      avaliacoes.ts
      planos.ts
      matriculas.ts        renovar(), status, histórico
      cobrancas.ts
      pagamentos.ts
      auth.ts
    rotas/
      alunos.ts
      avaliacoes.ts
      planos.ts
      matriculas.ts
      cobrancas.ts
      pagamentos.ts
      auth.ts
    plugins/
      autenticacao.ts      hook de sessão + verificação de papel
      erros.ts             tratador de erro padronizado
    servidor.ts            monta o Fastify
    index.ts               entrypoint
  shared/
    tipos.ts               tipos exportados para o frontend
  tests/
    dominio/
    servicos/
    rotas/
    helpers/
      db.ts                banco em memória para testes
```

Arquivos são divididos por **responsabilidade de domínio**, não por camada técnica: tudo que muda junto (serviço de matrícula, sua rota, seu teste) tem nome correspondente.

---

## Task 1: Setup do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/index.ts`, `src/servidor.ts`
- Test: `tests/servidor.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `construirServidor(): FastifyInstance` — usada por todos os testes de rota

- [ ] **Step 1: Inicializar o projeto e instalar dependências**

```bash
cd C:/Users/guilh/Desktop/Academia
npm init -y
npm i fastify @fastify/cookie zod drizzle-orm better-sqlite3 argon2 dotenv
npm i -D typescript tsx vitest @types/node @types/better-sqlite3 drizzle-kit
npx tsc --init
```

- [ ] **Step 2: Configurar `package.json`**

```json
{
  "name": "dark-fisic",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:seed": "tsx src/db/seed.ts"
  }
}
```

- [ ] **Step 3: Configurar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "shared/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: false, include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: Criar `.gitignore` e `.env.example`**

`.gitignore`:
```
node_modules/
dist/
dados/
midia/
backups/
logs/
.env
```

`.env.example`:
```
PORT=3000
DB_PATH=./dados/academia.db
SESSION_SECRET=troque-isto-por-uma-string-aleatoria-longa
ANTHROPIC_API_KEY=
```

- [ ] **Step 6: Escrever o teste que falha**

`tests/servidor.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { construirServidor } from '../src/servidor.js';

describe('servidor', () => {
  it('responde /status com versao e ok', async () => {
    const app = construirServidor();
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
});
```

- [ ] **Step 7: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/servidor.js'`

- [ ] **Step 8: Implementar o mínimo**

`src/servidor.ts`:
```ts
import Fastify, { type FastifyInstance } from 'fastify';

export function construirServidor(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/status', async () => ({
    ok: true,
    versao: process.env.npm_package_version ?? '0.1.0',
  }));

  return app;
}
```

`src/index.ts`:
```ts
import 'dotenv/config';
import { construirServidor } from './servidor.js';

const app = construirServidor();
const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`DARK FISIC rodando em http://localhost:${port}`))
  .catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 9: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: setup do projeto Node/TypeScript/Fastify com Vitest"
```

---

## Task 2: Utilitários de domínio — dinheiro e telefone

**Files:**
- Create: `src/dominio/dinheiro.ts`, `src/dominio/telefone.ts`
- Test: `tests/dominio/dinheiro.test.ts`, `tests/dominio/telefone.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `reaisParaCentavos(reais: number): number`
  - `centavosParaReais(centavos: number): number`
  - `formatarBRL(centavos: number): string`
  - `normalizarTelefone(entrada: string): string` — lança `Error` se inválido
  - `telefoneValido(entrada: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

`tests/dominio/dinheiro.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { reaisParaCentavos, centavosParaReais, formatarBRL } from '../../src/dominio/dinheiro.js';

describe('dinheiro', () => {
  it('converte reais para centavos sem erro de float', () => {
    expect(reaisParaCentavos(139)).toBe(13900);
    expect(reaisParaCentavos(89.9)).toBe(8990);
    expect(reaisParaCentavos(0.1)).toBe(10);
    expect(reaisParaCentavos(1.005)).toBe(101);
  });

  it('converte centavos para reais', () => {
    expect(centavosParaReais(13900)).toBe(139);
    expect(centavosParaReais(8990)).toBe(89.9);
  });

  it('formata em BRL', () => {
    expect(formatarBRL(13900)).toBe('R$ 139,00');
    expect(formatarBRL(8990)).toBe('R$ 89,90');
    expect(formatarBRL(0)).toBe('R$ 0,00');
    expect(formatarBRL(118800)).toBe('R$ 1.188,00');
  });

  it('rejeita centavos nao inteiros', () => {
    expect(() => formatarBRL(139.5)).toThrow();
  });
});
```

`tests/dominio/telefone.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizarTelefone, telefoneValido } from '../../src/dominio/telefone.js';

describe('telefone', () => {
  it('normaliza formatos brasileiros comuns para E.164', () => {
    expect(normalizarTelefone('(11) 9 8000-1111')).toBe('+5511980001111');
    expect(normalizarTelefone('11980001111')).toBe('+5511980001111');
    expect(normalizarTelefone('+55 11 98000-1111')).toBe('+5511980001111');
    expect(normalizarTelefone('011 98000 1111')).toBe('+5511980001111');
  });

  it('aceita fixo de 8 digitos', () => {
    expect(normalizarTelefone('(11) 3333-4444')).toBe('+551133334444');
  });

  it('rejeita numero curto demais', () => {
    expect(() => normalizarTelefone('99999')).toThrow('Telefone inválido');
    expect(telefoneValido('99999')).toBe(false);
  });

  it('rejeita DDD invalido', () => {
    expect(() => normalizarTelefone('(00) 98000-1111')).toThrow('Telefone inválido');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/dominio`
Expected: FAIL — módulos não existem

- [ ] **Step 3: Implementar `src/dominio/dinheiro.ts`**

```ts
/** Converte reais (float vindo de formulário) para centavos inteiros. */
export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais)) throw new Error('Valor inválido');
  // Math.round em string evita 89.9 * 100 === 8989.999999999999
  return Math.round(Number((reais * 100).toFixed(4)));
}

export function centavosParaReais(centavos: number): number {
  garantirInteiro(centavos);
  return centavos / 100;
}

export function formatarBRL(centavos: number): string {
  garantirInteiro(centavos);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(centavos / 100).replace(/\u00A0/g, ' ');
}

function garantirInteiro(centavos: number): void {
  if (!Number.isInteger(centavos)) {
    throw new Error(`Centavos deve ser inteiro, recebido: ${centavos}`);
  }
}
```

- [ ] **Step 4: Implementar `src/dominio/telefone.ts`**

```ts
const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19, 21,22,24, 27,28,
  31,32,33,34,35,37,38, 41,42,43,44,45,46, 47,48,49,
  51,53,54,55, 61, 62,64, 63, 65,66, 67, 68, 69,
  71,73,74,75,77, 79, 81,87, 82, 83, 84, 85,88, 86,89,
  91,93,94, 92,97, 95, 96, 98,99,
]);

/** Normaliza telefone brasileiro para E.164. Lança se inválido. */
export function normalizarTelefone(entrada: string): string {
  let d = (entrada ?? '').replace(/\D/g, '');

  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);

  if (d.length !== 10 && d.length !== 11) {
    throw new Error('Telefone inválido');
  }
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) {
    throw new Error('Telefone inválido');
  }
  if (d.length === 11 && d[2] !== '9') {
    throw new Error('Telefone inválido');
  }

  return `+55${d}`;
}

export function telefoneValido(entrada: string): boolean {
  try { normalizarTelefone(entrada); return true; } catch { return false; }
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx vitest run tests/dominio`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/dominio tests/dominio
git commit -m "feat(dominio): centavos inteiros e telefone E.164"
```

---

## Task 3: Utilitários de domínio — datas com âncora

Esta é a lógica mais delicada do sistema. Erro aqui cobra o aluno na data errada.

**Files:**
- Create: `src/dominio/datas.ts`
- Test: `tests/dominio/datas.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type DataISO = string` — `'YYYY-MM-DD'`
  - `hoje(): DataISO`
  - `ultimoDiaDoMes(ano: number, mes1a12: number): number`
  - `adicionarMeses(inicio: DataISO, meses: number, diaAncora: number): DataISO`
  - `diffDias(de: DataISO, ate: DataISO): number`
  - `maiorData(a: DataISO, b: DataISO): DataISO`

- [ ] **Step 1: Escrever o teste que falha**

`tests/dominio/datas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  adicionarMeses, ultimoDiaDoMes, diffDias, maiorData,
} from '../../src/dominio/datas.js';

describe('ultimoDiaDoMes', () => {
  it('conhece meses curtos e bissextos', () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 12)).toBe(31);
  });
});

describe('adicionarMeses', () => {
  it('caso simples', () => {
    expect(adicionarMeses('2026-09-10', 1, 10)).toBe('2026-10-10');
    expect(adicionarMeses('2026-09-10', 3, 10)).toBe('2026-12-10');
    expect(adicionarMeses('2026-09-10', 12, 10)).toBe('2027-09-10');
  });

  it('vira o ano', () => {
    expect(adicionarMeses('2026-11-15', 3, 15)).toBe('2027-02-15');
  });

  it('encurta quando o mes destino nao tem o dia ancora', () => {
    expect(adicionarMeses('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(adicionarMeses('2028-01-31', 1, 31)).toBe('2028-02-29');
    expect(adicionarMeses('2026-03-31', 1, 31)).toBe('2026-04-30');
  });

  it('RESTAURA o dia ancora quando o mes destino comporta', () => {
    // este é o bug que a âncora existe para evitar:
    // sem ela, 31/01 -> 28/02 -> 28/03 e o aluno perde 3 dias por ano
    expect(adicionarMeses('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(adicionarMeses('2026-04-30', 1, 31)).toBe('2026-05-31');
  });
});

describe('diffDias', () => {
  it('conta dias entre datas', () => {
    expect(diffDias('2026-09-08', '2026-09-13')).toBe(5);
    expect(diffDias('2026-09-13', '2026-09-08')).toBe(-5);
    expect(diffDias('2026-09-08', '2026-09-08')).toBe(0);
  });

  it('atravessa virada de mes e ano', () => {
    expect(diffDias('2026-12-30', '2027-01-02')).toBe(3);
  });
});

describe('maiorData', () => {
  it('devolve a mais recente', () => {
    expect(maiorData('2026-09-10', '2026-09-08')).toBe('2026-09-10');
    expect(maiorData('2026-09-08', '2026-09-20')).toBe('2026-09-20');
    expect(maiorData('2026-09-08', '2026-09-08')).toBe('2026-09-08');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/dominio/datas.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/dominio/datas.ts`**

```ts
export type DataISO = string; // 'YYYY-MM-DD'

const RE = /^\d{4}-\d{2}-\d{2}$/;

function partes(d: DataISO): [number, number, number] {
  if (!RE.test(d)) throw new Error(`Data inválida: ${d}`);
  const [a, m, dia] = d.split('-').map(Number);
  return [a, m, dia];
}

function montar(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function hoje(): DataISO {
  // Data de calendário no fuso da academia, não UTC.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function ultimoDiaDoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

/**
 * Soma meses preservando o dia âncora original da matrícula.
 * O dia âncora impede o vencimento de escorregar permanentemente
 * quando passa por um mês curto (31/01 -> 28/02 -> 31/03, não 28/03).
 */
export function adicionarMeses(inicio: DataISO, meses: number, diaAncora: number): DataISO {
  const [ano, mes] = partes(inicio);
  if (!Number.isInteger(diaAncora) || diaAncora < 1 || diaAncora > 31) {
    throw new Error(`Dia âncora inválido: ${diaAncora}`);
  }

  const totalMeses = (ano * 12 + (mes - 1)) + meses;
  const novoAno = Math.floor(totalMeses / 12);
  const novoMes = (totalMeses % 12) + 1;

  const dia = Math.min(diaAncora, ultimoDiaDoMes(novoAno, novoMes));
  return montar(novoAno, novoMes, dia);
}

export function diffDias(de: DataISO, ate: DataISO): number {
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

export function maiorData(a: DataISO, b: DataISO): DataISO {
  partes(a); partes(b);
  return a >= b ? a : b; // ISO ordena lexicograficamente
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run tests/dominio/datas.test.ts`
Expected: PASS — 12 testes

- [ ] **Step 5: Commit**

```bash
git add src/dominio/datas.ts tests/dominio/datas.test.ts
git commit -m "feat(dominio): aritmetica de datas com dia ancora"
```

---

## Task 4: Schema do banco

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - Tabelas Drizzle exportadas: `academia`, `usuario`, `aluno`, `tagRestricao`, `avaliacaoFisica`, `plano`, `matricula`, `cobranca`, `pagamento`, `logAuditoria`
  - `abrirBanco(caminho: string): BetterSQLite3Database`
  - `criarBancoDeTeste(): { db, fechar }` (em memória)

> **Nota de escopo:** este plano cria apenas as tabelas dos módulos que ele
> implementa. As tabelas de check-in, aulas, treino e mensageria entram nos
> planos 2 e 3, como migrations adicionais.

- [ ] **Step 1: Escrever o teste que falha**

`tests/db/schema.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { aluno, plano } from '../../src/db/schema.js';

let fechar: () => void;
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

  it('impede telefone duplicado nao ser problema mas cpf sim', async () => {
    const t = criarBancoDeTeste(); fechar = t.fechar;
    await t.db.insert(aluno).values({ nome: 'A', telefone: '+5511980001111', cpf: '111.222.333-01' });
    await expect(
      t.db.insert(aluno).values({ nome: 'B', telefone: '+5511980002222', cpf: '111.222.333-01' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/db`
Expected: FAIL — módulos não existem

- [ ] **Step 3: Implementar `src/db/schema.ts`**

```ts
import { sqliteTable, text, integer, real, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const agora = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

const base = {
  id: integer('id').primaryKey({ autoIncrement: true }),
  criadoEm: text('criado_em').notNull().default(agora),
  atualizadoEm: text('atualizado_em').notNull().default(agora),
};

export const academia = sqliteTable('academia', {
  ...base,
  nome: text('nome').notNull(),
  cnpj: text('cnpj'),
  endereco: text('endereco'),
  telefone: text('telefone'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  responsavel: text('responsavel'),
  pixChave: text('pix_chave'),
  pixTipo: text('pix_tipo'),
  pixNomeRecebedor: text('pix_nome_recebedor'),
  pixCidade: text('pix_cidade'),
  logoPath: text('logo_path'),
  diasAvisoVencimento: integer('dias_aviso_vencimento').notNull().default(5),
  diasAlunoSumido: integer('dias_aluno_sumido').notNull().default(10),
  volumeMaxSeriesIniciante: integer('volume_max_series_iniciante').notNull().default(12),
  volumeMaxSeriesIntermediario: integer('volume_max_series_intermediario').notNull().default(18),
  volumeMaxSeriesAvancado: integer('volume_max_series_avancado').notNull().default(24),
});

export const usuario = sqliteTable('usuario', {
  ...base,
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash'),
  papel: text('papel', { enum: ['dono', 'recepcao', 'professor'] }).notNull(),
  cref: text('cref'),
  especialidade: text('especialidade'),
  telefone: text('telefone'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  ultimoLogin: text('ultimo_login'),
});

export const tagRestricao = sqliteTable('tag_restricao', {
  ...base,
  codigo: text('codigo').notNull().unique(),
  rotulo: text('rotulo').notNull(),
});

export const aluno = sqliteTable('aluno', {
  ...base,
  nome: text('nome').notNull(),
  cpf: text('cpf').unique(),
  dataNascimento: text('data_nascimento'),
  sexo: text('sexo'),
  telefone: text('telefone').notNull(),
  email: text('email'),
  endereco: text('endereco'),
  observacoesMedicas: text('observacoes_medicas'),
  restricoes: text('restricoes', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  fotoPath: text('foto_path'),
  aceitaWhatsapp: integer('aceita_whatsapp', { mode: 'boolean' }).notNull().default(false),
  consentimentoLgpdEm: text('consentimento_lgpd_em'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
}, (t) => ({
  idxNome: index('idx_aluno_nome').on(t.nome),
  idxTelefone: index('idx_aluno_telefone').on(t.telefone),
}));

export const avaliacaoFisica = sqliteTable('avaliacao_fisica', {
  ...base,
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  data: text('data').notNull(),
  pesoKg: real('peso_kg'),
  alturaM: real('altura_m'),
  percGordura: real('perc_gordura'),
  circBraco: real('circ_braco'),
  circPeito: real('circ_peito'),
  circCintura: real('circ_cintura'),
  circQuadril: real('circ_quadril'),
  circCoxa: real('circ_coxa'),
  circOmbros: real('circ_ombros'),
  objetivo: text('objetivo', {
    enum: ['hipertrofia','emagrecimento','definicao','condicionamento','saude_geral','reabilitacao'],
  }),
  nivel: text('nivel', { enum: ['iniciante','intermediario','avancado'] }),
  avaliadorUsuarioId: integer('avaliador_usuario_id').references(() => usuario.id),
  observacoes: text('observacoes'),
}, (t) => ({
  idxAlunoData: index('idx_avaliacao_aluno_data').on(t.alunoId, t.data),
}));

export const plano = sqliteTable('plano', {
  ...base,
  nome: text('nome').notNull(),
  precoCentavos: integer('preco_centavos').notNull(),
  duracaoMeses: integer('duracao_meses').notNull(),
  descricao: text('descricao'),
  beneficios: text('beneficios', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  destaque: integer('destaque', { mode: 'boolean' }).notNull().default(false),
  ordem: integer('ordem').notNull().default(0),
});

export const matricula = sqliteTable('matricula', {
  ...base,
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  planoId: integer('plano_id').notNull().references(() => plano.id),
  dataInicio: text('data_inicio').notNull(),
  dataFim: text('data_fim').notNull(),
  diaAncora: integer('dia_ancora').notNull(),
  valorCentavos: integer('valor_centavos').notNull(),
  formaPagamentoPreferida: text('forma_pagamento_preferida'),
  status: text('status', { enum: ['ativa','encerrada','cancelada'] }).notNull().default('ativa'),
  observacao: text('observacao'),
}, (t) => ({
  idxAluno: index('idx_matricula_aluno').on(t.alunoId, t.dataFim),
}));

export const cobranca = sqliteTable('cobranca', {
  ...base,
  matriculaId: integer('matricula_id').references(() => matricula.id),
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  competencia: text('competencia').notNull(),
  valorCentavos: integer('valor_centavos').notNull(),
  vencimento: text('vencimento').notNull(),
  status: text('status', { enum: ['aberta','paga','cancelada'] }).notNull().default('aberta'),
  pixTxid: text('pix_txid'),
  pixPayload: text('pix_payload'),
  pixQrPath: text('pix_qr_path'),
}, (t) => ({
  idxAlunoStatus: index('idx_cobranca_aluno_status').on(t.alunoId, t.status),
  unqCompetencia: unique('unq_cobranca_matricula_competencia').on(t.matriculaId, t.competencia),
}));

export const pagamento = sqliteTable('pagamento', {
  ...base,
  cobrancaId: integer('cobranca_id').references(() => cobranca.id),
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  valorCentavos: integer('valor_centavos').notNull(),
  forma: text('forma', { enum: ['pix','dinheiro','credito','debito','boleto'] }).notNull(),
  dataPagamento: text('data_pagamento').notNull(),
  registradoPorUsuarioId: integer('registrado_por_usuario_id').references(() => usuario.id),
  observacao: text('observacao'),
}, (t) => ({
  idxData: index('idx_pagamento_data').on(t.dataPagamento),
}));

export const logAuditoria = sqliteTable('log_auditoria', {
  ...base,
  usuarioId: integer('usuario_id').references(() => usuario.id),
  acao: text('acao').notNull(),
  entidade: text('entidade').notNull(),
  entidadeId: integer('entidade_id'),
  dadosAntes: text('dados_antes', { mode: 'json' }),
  dadosDepois: text('dados_depois', { mode: 'json' }),
  ip: text('ip'),
});
```

- [ ] **Step 4: Implementar `src/db/client.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.js';

export function abrirBanco(caminho: string) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const sqlite = new Database(caminho);

  // WAL melhora leitura concorrente; foreign_keys NÃO vem ligado por padrão
  // no SQLite — sem isto as FKs do schema seriam decorativas.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  return { sqlite, db: drizzle(sqlite, { schema }) };
}
```

- [ ] **Step 5: Implementar `drizzle.config.ts` e gerar a migration**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
} satisfies Config;
```

Run: `npm run db:generate`
Expected: cria `drizzle/0000_*.sql`

- [ ] **Step 6: Implementar `tests/helpers/db.ts`**

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirBanco } from '../../src/db/client.js';

export function criarBancoDeTeste() {
  const { sqlite, db } = abrirBanco(':memory:');
  const dir = join(process.cwd(), 'drizzle');
  for (const arquivo of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, arquivo), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const t = stmt.trim();
      if (t) sqlite.exec(t);
    }
  }
  return { db, sqlite, fechar: () => sqlite.close() };
}
```

- [ ] **Step 7: Rodar e confirmar que passam**

Run: `npx vitest run tests/db`
Expected: PASS — 3 testes

- [ ] **Step 8: Commit**

```bash
git add src/db drizzle drizzle.config.ts tests/db tests/helpers
git commit -m "feat(db): schema Drizzle do nucleo com FKs ativas"
```

---

## Task 5: Status derivado do aluno

**Files:**
- Create: `src/dominio/status.ts`
- Test: `tests/dominio/status.test.ts`

**Interfaces:**
- Consumes: `diffDias`, `DataISO` de `src/dominio/datas.ts`
- Produces:
  - `type StatusAluno = 'ativo' | 'vencendo' | 'vencido' | 'inativo'`
  - `statusDoAluno(dataFim: DataISO | null, hojeISO: DataISO, diasAviso: number): StatusAluno`
  - `diasParaVencer(dataFim: DataISO | null, hojeISO: DataISO): number | null`

- [ ] **Step 1: Escrever o teste que falha**

`tests/dominio/status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { statusDoAluno, diasParaVencer } from '../../src/dominio/status.js';

const HOJE = '2026-09-08';

describe('statusDoAluno', () => {
  it('sem matricula é inativo', () => {
    expect(statusDoAluno(null, HOJE, 5)).toBe('inativo');
  });

  it('vencimento no futuro distante é ativo', () => {
    expect(statusDoAluno('2026-10-08', HOJE, 5)).toBe('ativo');
  });

  it('dentro da janela de aviso é vencendo', () => {
    expect(statusDoAluno('2026-09-13', HOJE, 5)).toBe('vencendo');
    expect(statusDoAluno('2026-09-09', HOJE, 5)).toBe('vencendo');
  });

  it('vence exatamente hoje ainda é vencendo, não vencido', () => {
    expect(statusDoAluno(HOJE, HOJE, 5)).toBe('vencendo');
  });

  it('ontem já é vencido', () => {
    expect(statusDoAluno('2026-09-07', HOJE, 5)).toBe('vencido');
  });

  it('respeita janela de aviso configurada', () => {
    expect(statusDoAluno('2026-09-13', HOJE, 3)).toBe('ativo');
    expect(statusDoAluno('2026-09-13', HOJE, 10)).toBe('vencendo');
  });
});

describe('diasParaVencer', () => {
  it('positivo no futuro, negativo no passado', () => {
    expect(diasParaVencer('2026-09-13', HOJE)).toBe(5);
    expect(diasParaVencer('2026-09-01', HOJE)).toBe(-7);
    expect(diasParaVencer(null, HOJE)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/dominio/status.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/dominio/status.ts`**

```ts
import { diffDias, type DataISO } from './datas.js';

export type StatusAluno = 'ativo' | 'vencendo' | 'vencido' | 'inativo';

/**
 * Status é SEMPRE derivado — nunca armazenado.
 * Uma implementação só, consumida por telas, relatórios, job e bots.
 */
export function statusDoAluno(
  dataFim: DataISO | null,
  hojeISO: DataISO,
  diasAviso: number,
): StatusAluno {
  if (!dataFim) return 'inativo';
  const dias = diffDias(hojeISO, dataFim);
  if (dias < 0) return 'vencido';
  if (dias <= diasAviso) return 'vencendo';
  return 'ativo';
}

export function diasParaVencer(dataFim: DataISO | null, hojeISO: DataISO): number | null {
  return dataFim ? diffDias(hojeISO, dataFim) : null;
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run tests/dominio/status.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dominio/status.ts tests/dominio/status.test.ts
git commit -m "feat(dominio): status do aluno derivado da matricula"
```

---

## Task 6: Regra de renovação de matrícula

Implementa §5.2 da spec, **com o refinamento do reset de âncora em pagamento atrasado**.

**Files:**
- Create: `src/dominio/renovacao.ts`
- Test: `tests/dominio/renovacao.test.ts`

**Interfaces:**
- Consumes: `adicionarMeses`, `maiorData`, `DataISO`
- Produces:
  - `type PeriodoRenovado = { dataInicio: DataISO; dataFim: DataISO; diaAncora: number }`
  - `calcularRenovacao(args: { dataFimAnterior: DataISO | null; diaAncoraAtual: number | null; dataPagamento: DataISO; duracaoMeses: number }): PeriodoRenovado`

- [ ] **Step 1: Escrever o teste que falha**

`tests/dominio/renovacao.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calcularRenovacao } from '../../src/dominio/renovacao.js';

describe('calcularRenovacao', () => {
  it('primeira matricula ancora no dia do pagamento', () => {
    const r = calcularRenovacao({
      dataFimAnterior: null, diaAncoraAtual: null,
      dataPagamento: '2026-09-10', duracaoMeses: 1,
    });
    expect(r).toEqual({ dataInicio: '2026-09-10', dataFim: '2026-10-10', diaAncora: 10 });
  });

  it('pagamento ADIANTADO conta do vencimento antigo', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-08', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-09-10');
    expect(r.dataFim).toBe('2026-10-10');
    expect(r.diaAncora).toBe(10);
  });

  it('pagamento EM DIA conta do vencimento', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-10', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-09-10');
    expect(r.dataFim).toBe('2026-10-10');
  });

  it('pagamento ATRASADO conta da data do pagamento E reancora', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-20', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-09-20');
    expect(r.dataFim).toBe('2026-10-20');
    expect(r.diaAncora).toBe(20);
  });

  it('atrasado em mes curto nao entrega periodo mutilado', () => {
    // sem o reset de âncora isto daria 31/03: 21 dias por um mês pago
    const r = calcularRenovacao({
      dataFimAnterior: '2026-02-28', diaAncoraAtual: 31,
      dataPagamento: '2026-03-10', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-03-10');
    expect(r.dataFim).toBe('2026-04-10');
    expect(r.diaAncora).toBe(10);
  });

  it('adiantado preserva a ancora e restaura o dia 31', () => {
    const r = calcularRenovacao({
      dataFimAnterior: '2026-02-28', diaAncoraAtual: 31,
      dataPagamento: '2026-02-20', duracaoMeses: 1,
    });
    expect(r.dataInicio).toBe('2026-02-28');
    expect(r.dataFim).toBe('2026-03-31');
    expect(r.diaAncora).toBe(31);
  });

  it('plano trimestral e anual', () => {
    expect(calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-10', duracaoMeses: 3,
    }).dataFim).toBe('2026-12-10');

    expect(calcularRenovacao({
      dataFimAnterior: '2026-09-10', diaAncoraAtual: 10,
      dataPagamento: '2026-09-10', duracaoMeses: 12,
    }).dataFim).toBe('2027-09-10');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/dominio/renovacao.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/dominio/renovacao.ts`**

```ts
import { adicionarMeses, type DataISO } from './datas.js';

export type PeriodoRenovado = {
  dataInicio: DataISO;
  dataFim: DataISO;
  diaAncora: number;
};

/**
 * Regra da §5.2 da spec:
 *   - pagamento adiantado ou em dia  -> conta do vencimento antigo, âncora preservada
 *   - pagamento atrasado             -> conta da data do pagamento, âncora RESETADA
 *
 * O reset da âncora no atraso é essencial: manter a âncora antiga entregaria
 * um período mutilado (ex.: pagou 10/03 com âncora 31 -> venceria 31/03).
 */
export function calcularRenovacao(args: {
  dataFimAnterior: DataISO | null;
  diaAncoraAtual: number | null;
  dataPagamento: DataISO;
  duracaoMeses: number;
}): PeriodoRenovado {
  const { dataFimAnterior, diaAncoraAtual, dataPagamento, duracaoMeses } = args;

  if (duracaoMeses < 1 || !Number.isInteger(duracaoMeses)) {
    throw new Error(`Duração inválida: ${duracaoMeses}`);
  }

  const atrasadoOuNovo = !dataFimAnterior || dataPagamento > dataFimAnterior;

  const dataInicio = atrasadoOuNovo ? dataPagamento : dataFimAnterior;
  const diaAncora = atrasadoOuNovo
    ? Number(dataPagamento.slice(8, 10))
    : (diaAncoraAtual ?? Number(dataInicio.slice(8, 10)));

  return {
    dataInicio,
    dataFim: adicionarMeses(dataInicio, duracaoMeses, diaAncora),
    diaAncora,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run tests/dominio/renovacao.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add src/dominio/renovacao.ts tests/dominio/renovacao.test.ts
git commit -m "feat(dominio): regra de renovacao com reset de ancora no atraso"
```

---

## Task 7: Pix — montagem do BR Code

**Files:**
- Create: `src/dominio/pix.ts`
- Test: `tests/dominio/pix.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `montarBrCode(args: { chave: string; nomeRecebedor: string; cidade: string; valorCentavos?: number; txid?: string }): string`
  - `crc16(payload: string): string`

O BR Code é uma cadeia TLV (`ID` + `tamanho` 2 dígitos + `valor`), terminada
pelo campo `6304` seguido do CRC-16/CCITT-FALSE em hexadecimal maiúsculo.

- [ ] **Step 1: Escrever o teste que falha**

`tests/dominio/pix.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { montarBrCode, crc16 } from '../../src/dominio/pix.js';

describe('crc16', () => {
  it('calcula CRC-16/CCITT-FALSE', () => {
    // vetor de teste padrão do algoritmo
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('montarBrCode', () => {
  const base = {
    chave: 'darkfisic@email.com',
    nomeRecebedor: 'DARK FISIC ACADEMIA',
    cidade: 'SAO PAULO',
  };

  it('comeca com payload format indicator', () => {
    expect(montarBrCode(base).startsWith('000201')).toBe(true);
  });

  it('termina com o campo CRC de 4 digitos hex', () => {
    const p = montarBrCode(base);
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('o CRC confere com o proprio payload', () => {
    const p = montarBrCode(base);
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });

  it('inclui a chave pix no merchant account information', () => {
    expect(montarBrCode(base)).toContain('BR.GOV.BCB.PIX');
    expect(montarBrCode(base)).toContain('darkfisic@email.com');
  });

  it('inclui valor formatado com duas casas quando informado', () => {
    expect(montarBrCode({ ...base, valorCentavos: 13900 })).toContain('5406139.00');
    expect(montarBrCode({ ...base, valorCentavos: 8990 })).toContain('540589.90');
  });

  it('omite o campo de valor quando nao informado', () => {
    expect(montarBrCode(base)).not.toMatch(/54\d{2}/);
  });

  it('trunca e higieniza nome e cidade', () => {
    const p = montarBrCode({
      ...base,
      nomeRecebedor: 'Academia Ação & Saúde Ltda com nome muito muito longo',
      cidade: 'São José dos Campos',
    });
    expect(p).toContain('SAO JOSE DOS CAMPOS');
    expect(p).not.toMatch(/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ&]/);
  });

  it('usa txid informado e *** como padrao', () => {
    expect(montarBrCode({ ...base, txid: 'COB1234' })).toContain('COB1234');
    expect(montarBrCode(base)).toContain('0503***');
  });

  it('rejeita chave vazia', () => {
    expect(() => montarBrCode({ ...base, chave: '' })).toThrow('Chave Pix');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/dominio/pix.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/dominio/pix.ts`**

```ts
/** Campo TLV: id + tamanho em 2 dígitos + valor. */
function tlv(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor;
}

/** Remove acentos, símbolos fora do permitido, e força maiúsculas. */
function higienizar(texto: string, max: number): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, sem reflexão. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function montarBrCode(args: {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valorCentavos?: number;
  txid?: string;
}): string {
  const { chave, valorCentavos, txid } = args;
  if (!chave?.trim()) throw new Error('Chave Pix não configurada');

  const nome = higienizar(args.nomeRecebedor, 25);
  const cidade = higienizar(args.cidade, 15);
  const id = higienizar(txid ?? '***', 25) || '***';

  let p = '';
  p += tlv('00', '01');                                        // payload format
  p += tlv('26', tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave)); // conta pix
  p += tlv('52', '0000');                                      // categoria
  p += tlv('53', '986');                                       // BRL

  if (valorCentavos != null) {
    if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
      throw new Error('Valor deve ser inteiro em centavos e maior que zero');
    }
    p += tlv('54', (valorCentavos / 100).toFixed(2));
  }

  p += tlv('58', 'BR');
  p += tlv('59', nome);
  p += tlv('60', cidade);
  p += tlv('62', tlv('05', txid ? id : '***'));

  p += '6304';
  return p + crc16(p);
}
```

> **Nota:** `higienizar` é aplicada ao txid mas o teste `0503***` exige que o
> padrão sem txid mantenha os asteriscos — por isso o ternário na linha do
> campo `62`.

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run tests/dominio/pix.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 5: Validar manualmente com um app de banco**

Gerar um BR Code de teste com a chave real da academia e valor de R$ 0,01,
colar no app do banco e confirmar que o app reconhece o recebedor.
**Não concluir a task sem esse teste** — um BR Code sintaticamente válido
mas semanticamente errado passa em todo teste unitário e falha no balcão.

- [ ] **Step 6: Commit**

```bash
git add src/dominio/pix.ts tests/dominio/pix.test.ts
git commit -m "feat(dominio): geracao de BR Code Pix estatico com CRC16"
```

---

## Task 8: Serviço de matrículas

Primeiro serviço a integrar domínio + banco. Estabelece o padrão dos demais.

**Files:**
- Create: `src/servicos/matriculas.ts`
- Test: `tests/servicos/matriculas.test.ts`

**Interfaces:**
- Consumes: `calcularRenovacao`, `statusDoAluno`, `hoje`, schema Drizzle
- Produces:
  - `criarServicoMatriculas(db): ServicoMatriculas`
  - `ServicoMatriculas.matriculaAtual(alunoId): Promise<Matricula | null>`
  - `ServicoMatriculas.renovar(args): Promise<Matricula>`
  - `ServicoMatriculas.statusDe(alunoId): Promise<{ status: StatusAluno; diasParaVencer: number | null }>`

- [ ] **Step 1: Escrever o teste que falha**

`tests/servicos/matriculas.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarBancoDeTeste } from '../helpers/db.js';
import { criarServicoMatriculas } from '../../src/servicos/matriculas.js';
import { aluno, plano, academia } from '../../src/db/schema.js';

let t: ReturnType<typeof criarBancoDeTeste>;
let servico: ReturnType<typeof criarServicoMatriculas>;
let alunoId: number, planoId: number;

beforeEach(async () => {
  t = criarBancoDeTeste();
  servico = criarServicoMatriculas(t.db);
  await t.db.insert(academia).values({ nome: 'DARK FISIC' });
  const [a] = await t.db.insert(aluno)
    .values({ nome: 'Rafael', telefone: '+5511980001111' }).returning();
  const [p] = await t.db.insert(plano)
    .values({ nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1 }).returning();
  alunoId = a.id; planoId = p.id;
});
afterEach(() => t.fechar());

describe('servico de matriculas', () => {
  it('aluno sem matricula é inativo', async () => {
    expect(await servico.matriculaAtual(alunoId)).toBeNull();
    const s = await servico.statusDe(alunoId, '2026-09-08');
    expect(s.status).toBe('inativo');
  });

  it('primeira matricula grava periodo e valor do plano', async () => {
    const m = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    expect(m.dataInicio).toBe('2026-09-10');
    expect(m.dataFim).toBe('2026-10-10');
    expect(m.diaAncora).toBe(10);
    expect(m.valorCentavos).toBe(13900);
    expect(m.status).toBe('ativa');
  });

  it('renovacao adiantada emenda no vencimento anterior', async () => {
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    const m2 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-08' });
    expect(m2.dataInicio).toBe('2026-10-10');
    expect(m2.dataFim).toBe('2026-11-10');
  });

  it('renovacao atrasada conta do pagamento', async () => {
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    const m2 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-20' });
    expect(m2.dataInicio).toBe('2026-10-20');
    expect(m2.dataFim).toBe('2026-11-20');
    expect(m2.diaAncora).toBe(20);
  });

  it('renovar encerra a matricula anterior', async () => {
    const m1 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-10' });
    const atual = await servico.matriculaAtual(alunoId);
    expect(atual!.id).not.toBe(m1.id);
    expect(atual!.dataFim).toBe('2026-11-10');
  });

  it('congela o preco do plano no momento da contratacao', async () => {
    const m1 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    await t.db.update(plano).set({ precoCentavos: 19900 });
    expect(m1.valorCentavos).toBe(13900);
    const m2 = await servico.renovar({ alunoId, planoId, dataPagamento: '2026-10-10' });
    expect(m2.valorCentavos).toBe(19900);
  });

  it('status reflete a matricula vigente', async () => {
    await servico.renovar({ alunoId, planoId, dataPagamento: '2026-09-10' });
    expect((await servico.statusDe(alunoId, '2026-09-15')).status).toBe('ativo');
    expect((await servico.statusDe(alunoId, '2026-10-07')).status).toBe('vencendo');
    expect((await servico.statusDe(alunoId, '2026-10-11')).status).toBe('vencido');
  });

  it('rejeita plano inexistente', async () => {
    await expect(
      servico.renovar({ alunoId, planoId: 9999, dataPagamento: '2026-09-10' })
    ).rejects.toThrow('Plano não encontrado');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run tests/servicos/matriculas.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `src/servicos/matriculas.ts`**

```ts
import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { matricula, plano, academia } from '../db/schema.js';
import { calcularRenovacao } from '../dominio/renovacao.js';
import { statusDoAluno, diasParaVencer, type StatusAluno } from '../dominio/status.js';
import { hoje, type DataISO } from '../dominio/datas.js';

export function criarServicoMatriculas(db: BetterSQLite3Database<any>) {
  async function matriculaAtual(alunoId: number) {
    const linhas = await db.select().from(matricula)
      .where(and(eq(matricula.alunoId, alunoId), eq(matricula.status, 'ativa')))
      .orderBy(desc(matricula.dataFim))
      .limit(1);
    return linhas[0] ?? null;
  }

  async function renovar(args: {
    alunoId: number; planoId: number; dataPagamento: DataISO; observacao?: string;
  }) {
    const [p] = await db.select().from(plano).where(eq(plano.id, args.planoId)).limit(1);
    if (!p) throw new Error('Plano não encontrado');

    const anterior = await matriculaAtual(args.alunoId);

    const periodo = calcularRenovacao({
      dataFimAnterior: anterior?.dataFim ?? null,
      diaAncoraAtual: anterior?.diaAncora ?? null,
      dataPagamento: args.dataPagamento,
      duracaoMeses: p.duracaoMeses,
    });

    if (anterior) {
      await db.update(matricula)
        .set({ status: 'encerrada' })
        .where(eq(matricula.id, anterior.id));
    }

    const [nova] = await db.insert(matricula).values({
      alunoId: args.alunoId,
      planoId: p.id,
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      diaAncora: periodo.diaAncora,
      valorCentavos: p.precoCentavos, // congela o preço vigente
      status: 'ativa',
      observacao: args.observacao,
    }).returning();

    return nova;
  }

  async function statusDe(alunoId: number, hojeISO: DataISO = hoje()) {
    const atual = await matriculaAtual(alunoId);
    const [cfg] = await db.select().from(academia).limit(1);
    const diasAviso = cfg?.diasAvisoVencimento ?? 5;

    return {
      status: statusDoAluno(atual?.dataFim ?? null, hojeISO, diasAviso) as StatusAluno,
      diasParaVencer: diasParaVencer(atual?.dataFim ?? null, hojeISO),
      matricula: atual,
    };
  }

  return { matriculaAtual, renovar, statusDe };
}

export type ServicoMatriculas = ReturnType<typeof criarServicoMatriculas>;
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run tests/servicos/matriculas.test.ts`
Expected: PASS — 8 testes

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os testes das tasks 1-8

- [ ] **Step 6: Commit**

```bash
git add src/servicos tests/servicos
git commit -m "feat(servicos): matriculas com renovacao e preco congelado"
```

---

## Self-Review

**Cobertura da spec neste plano:**

| Spec | Task | Situação |
|---|---|---|
| §3.1 camada de serviços | 8 | ✅ padrão estabelecido |
| §4 padrões (centavos, E.164, datas) | 2, 3 | ✅ |
| §4.1–4.3 tabelas do núcleo | 4 | ✅ |
| §5.1 status derivado | 5 | ✅ |
| §5.2 renovação | 6, 8 | ✅ + refinamento da âncora |
| §6 Pix BR Code | 7 | ✅ |
| §4.4–4.6, §5.3–5.5, §7, §8, §9, §10 | — | plano 2, 3 e 4 |

**Lacunas conhecidas e deliberadas** (endereçadas nos próximos planos): auth e
permissões (§5.6), alunos/avaliações CRUD, cobranças e pagamentos, check-in,
aulas, job diário, IA, frontend, deploy.

**Consistência de tipos:** `DataISO` é usada uniformemente em `datas.ts`,
`status.ts`, `renovacao.ts` e `matriculas.ts`. `calcularRenovacao` retorna
`PeriodoRenovado` com exatamente os três campos que a Task 8 consome.
`criarServicoMatriculas` é a única fábrica exportada, seguindo o padrão que os
serviços seguintes repetem.

---

## Próximos planos

- **Plano 2** — auth e papéis, alunos, avaliações, cobranças, pagamentos, check-in, aulas, job diário, relatórios
- **Plano 3** — biblioteca de exercícios, base de conhecimento, motor de IA, gate CREF
- **Plano 4** — frontend React (mobile+desktop), PWA, deploy Windows, túnel, backup
