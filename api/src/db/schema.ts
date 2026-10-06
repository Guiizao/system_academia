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

export const horarioFuncionamento = sqliteTable('horario_funcionamento', {
  ...base,
  diaSemana: integer('dia_semana').notNull(),
  aberto: integer('aberto', { mode: 'boolean' }).notNull().default(true),
  abre: text('abre'),
  fecha: text('fecha'),
}, (t) => ({
  unqDia: unique('unq_horario_dia').on(t.diaSemana),
}));

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
  /**
   * Diária: quantos dias corridos vale. Nulo = plano por mês.
   * Quem paga diária não entra na geração automática de cobrança.
   */
  duracaoDias: integer('duracao_dias'),
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

/* ─── autenticacao ─────────────────────────────────────── */

export const sessao = sqliteTable('sessao', {
  ...base,
  token: text('token').notNull().unique(),
  usuarioId: integer('usuario_id').notNull().references(() => usuario.id),
  expiraEm: text('expira_em').notNull(),
});

/* ─── frequencia ───────────────────────────────────────── */

export const checkin = sqliteTable('checkin', {
  ...base,
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  dataHora: text('data_hora').notNull(),
  // Dia de calendario NO FUSO DA ACADEMIA, fixado na gravacao.
  // Consultas de "hoje"/"mes" usam este campo -- nunca o slice do UTC,
  // que joga check-ins depois das 21h para o dia seguinte.
  dataLocal: text('data_local').notNull(),
  atividade: text('atividade').notNull(),
  origem: text('origem', { enum: ['manual', 'qr', 'catraca'] }).notNull().default('manual'),
  registradoPorUsuarioId: integer('registrado_por_usuario_id').references(() => usuario.id),
}, (t) => ({
  idxAlunoData: index('idx_checkin_aluno_data').on(t.alunoId, t.dataLocal),
  idxData: index('idx_checkin_data').on(t.dataLocal),
}));

/* ─── aulas ────────────────────────────────────────────── */

export const aula = sqliteTable('aula', {
  ...base,
  nome: text('nome').notNull(),
  diaSemana: integer('dia_semana').notNull(),
  hora: text('hora').notNull(),
  duracaoMin: integer('duracao_min').notNull().default(60),
  professorUsuarioId: integer('professor_usuario_id').references(() => usuario.id),
  vagas: integer('vagas').notNull(),
  local: text('local'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
});

/** Inscricao amarra ALUNO + DATA REAL -- nao so um contador. */
export const inscricaoAula = sqliteTable('inscricao_aula', {
  ...base,
  aulaId: integer('aula_id').notNull().references(() => aula.id),
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  data: text('data').notNull(),
  status: text('status', { enum: ['inscrito', 'presente', 'falta', 'cancelado'] })
    .notNull().default('inscrito'),
}, (t) => ({
  unqAlunoSessao: unique('unq_inscricao_aula_aluno_data').on(t.aulaId, t.alunoId, t.data),
  idxAulaData: index('idx_inscricao_aula_data').on(t.aulaId, t.data),
}));

/* ─── treino ───────────────────────────────────────────── */

export const exercicio = sqliteTable('exercicio', {
  ...base,
  nome: text('nome').notNull(),
  grupoMuscular: text('grupo_muscular').notNull(),
  padraoMovimento: text('padrao_movimento').notNull(),
  equipamento: text('equipamento').notNull(),
  nivelMinimo: text('nivel_minimo', { enum: ['iniciante','intermediario','avancado'] }).notNull(),
  contraindicacoes: text('contraindicacoes', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  seriesMin: integer('series_min').notNull().default(2),
  seriesMax: integer('series_max').notNull().default(4),
  videoPath: text('video_path'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
});

export const fichaTreino = sqliteTable('ficha_treino', {
  ...base,
  alunoId: integer('aluno_id').notNull().references(() => aluno.id),
  objetivo: text('objetivo').notNull(),
  nivel: text('nivel').notNull(),
  diasPorSemana: integer('dias_por_semana').notNull(),
  status: text('status', { enum: ['rascunho','aprovada','arquivada'] }).notNull().default('rascunho'),
  geradaPor: text('gerada_por', { enum: ['ia','manual','template'] }).notNull().default('manual'),
  criadoPorUsuarioId: integer('criado_por_usuario_id').references(() => usuario.id),
  aprovadaPorUsuarioId: integer('aprovada_por_usuario_id').references(() => usuario.id),
  aprovadaCref: text('aprovada_cref'),
  aprovadaEm: text('aprovada_em'),
});

export const fichaDivisao = sqliteTable('ficha_divisao', {
  ...base,
  fichaId: integer('ficha_id').notNull().references(() => fichaTreino.id),
  rotulo: text('rotulo').notNull(),
  foco: text('foco').notNull(),
  ordem: integer('ordem').notNull(),
});

/** exercicioId e FK obrigatoria: nada entra na ficha fora da biblioteca. */
export const fichaItem = sqliteTable('ficha_item', {
  ...base,
  divisaoId: integer('divisao_id').notNull().references(() => fichaDivisao.id),
  exercicioId: integer('exercicio_id').notNull().references(() => exercicio.id),
  ordem: integer('ordem').notNull(),
  series: integer('series').notNull(),
  reps: text('reps').notNull(),
  descansoSeg: integer('descanso_seg').notNull(),
  cargaOrientacao: text('carga_orientacao'),
});

/* ─── sistema / ganchos da fase 2 ──────────────────────── */

export const mensagemSaida = sqliteTable('mensagem_saida', {
  ...base,
  destinatario: text('destinatario').notNull(),
  canal: text('canal').notNull().default('whatsapp'),
  tipo: text('tipo').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  chaveIdempotencia: text('chave_idempotencia').notNull().unique(),
  status: text('status', { enum: ['pendente','enviada','falhou','cancelada'] }).notNull().default('pendente'),
  tentativas: integer('tentativas').notNull().default(0),
});
