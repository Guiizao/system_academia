import { z } from 'zod';

/**
 * Arquivo que o sistema reconhece na pasta "importar": alunos, planos,
 * matriculas e pagamentos ja normalizados. Tudo e conferido aqui antes de
 * tocar no banco -- arquivo vem de fora, nunca e confiavel.
 */
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data fora do formato AAAA-MM-DD')
  .refine((d) => {
    // 2026-02-31 passa na regex mas nao existe: viraria vencimento errado
    const [a, m, dia] = d.split('-').map(Number);
    const data = new Date(Date.UTC(a, m - 1, dia));
    return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === dia;
  }, 'Data que não existe no calendário');
const centavos = z.number().int().positive().max(10_000_000);
const nomeCurto = z.string().trim().min(1).max(120);

export const FORMAS = ['pix', 'dinheiro', 'credito', 'debito', 'boleto'] as const;
export type FormaPagamento = typeof FORMAS[number];

export const esquemaImportacao = z.object({
  formato: z.literal('darkfisic-importacao'),
  versao: z.literal(1),
  origem: z.string().max(200).optional(),
  geradoEm: z.string().max(40).optional(),
  // anotacoes de conferencia feitas na conversao; o sistema nao usa para nada
  avisos: z.array(z.string().max(300)).max(2000).optional(),
  planos: z.array(z.object({
    nome: nomeCurto,
    precoCentavos: centavos,
    duracaoMeses: z.number().int().min(1).max(24),
  })).max(50),
  alunos: z.array(z.object({
    nome: nomeCurto,
    telefone: z.string().regex(/^\+55\d{10,11}$/, 'Telefone fora do padrão +55').nullable(),
    aceitaWhatsapp: z.boolean(),
    plano: nomeCurto.nullable(),
    matricula: z.object({ dataInicio: dataISO, dataFim: dataISO }).nullable(),
    pagamentos: z.array(z.object({
      data: dataISO,
      valorCentavos: centavos,
      forma: z.enum(FORMAS),
    })).max(60),
  })).max(5000),
});

export type ArquivoImportacao = z.infer<typeof esquemaImportacao>;
export type AlunoImportado = ArquivoImportacao['alunos'][number];
export type PlanoImportado = ArquivoImportacao['planos'][number];
