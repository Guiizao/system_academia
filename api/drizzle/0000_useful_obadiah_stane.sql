CREATE TABLE `academia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`cnpj` text,
	`endereco` text,
	`telefone` text,
	`whatsapp` text,
	`instagram` text,
	`responsavel` text,
	`pix_chave` text,
	`pix_tipo` text,
	`pix_nome_recebedor` text,
	`pix_cidade` text,
	`logo_path` text,
	`dias_aviso_vencimento` integer DEFAULT 5 NOT NULL,
	`dias_aluno_sumido` integer DEFAULT 10 NOT NULL,
	`volume_max_series_iniciante` integer DEFAULT 12 NOT NULL,
	`volume_max_series_intermediario` integer DEFAULT 18 NOT NULL,
	`volume_max_series_avancado` integer DEFAULT 24 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `aluno` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`cpf` text,
	`data_nascimento` text,
	`sexo` text,
	`telefone` text NOT NULL,
	`email` text,
	`endereco` text,
	`observacoes_medicas` text,
	`restricoes` text DEFAULT '[]' NOT NULL,
	`foto_path` text,
	`aceita_whatsapp` integer DEFAULT false NOT NULL,
	`consentimento_lgpd_em` text,
	`ativo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aluno_cpf_unique` ON `aluno` (`cpf`);--> statement-breakpoint
CREATE INDEX `idx_aluno_nome` ON `aluno` (`nome`);--> statement-breakpoint
CREATE INDEX `idx_aluno_telefone` ON `aluno` (`telefone`);--> statement-breakpoint
CREATE TABLE `aula` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`dia_semana` integer NOT NULL,
	`hora` text NOT NULL,
	`duracao_min` integer DEFAULT 60 NOT NULL,
	`professor_usuario_id` integer,
	`vagas` integer NOT NULL,
	`local` text,
	`ativo` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`professor_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `avaliacao_fisica` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`aluno_id` integer NOT NULL,
	`data` text NOT NULL,
	`peso_kg` real,
	`altura_m` real,
	`perc_gordura` real,
	`circ_braco` real,
	`circ_peito` real,
	`circ_cintura` real,
	`circ_quadril` real,
	`circ_coxa` real,
	`circ_ombros` real,
	`objetivo` text,
	`nivel` text,
	`avaliador_usuario_id` integer,
	`observacoes` text,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`avaliador_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_avaliacao_aluno_data` ON `avaliacao_fisica` (`aluno_id`,`data`);--> statement-breakpoint
CREATE TABLE `checkin` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`aluno_id` integer NOT NULL,
	`data_hora` text NOT NULL,
	`data_local` text NOT NULL,
	`atividade` text NOT NULL,
	`origem` text DEFAULT 'manual' NOT NULL,
	`registrado_por_usuario_id` integer,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_checkin_aluno_data` ON `checkin` (`aluno_id`,`data_local`);--> statement-breakpoint
CREATE INDEX `idx_checkin_data` ON `checkin` (`data_local`);--> statement-breakpoint
CREATE TABLE `cobranca` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`matricula_id` integer,
	`aluno_id` integer NOT NULL,
	`competencia` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`vencimento` text NOT NULL,
	`status` text DEFAULT 'aberta' NOT NULL,
	`pix_txid` text,
	`pix_payload` text,
	`pix_qr_path` text,
	FOREIGN KEY (`matricula_id`) REFERENCES `matricula`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cobranca_aluno_status` ON `cobranca` (`aluno_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_cobranca_matricula_competencia` ON `cobranca` (`matricula_id`,`competencia`);--> statement-breakpoint
CREATE TABLE `exercicio` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`grupo_muscular` text NOT NULL,
	`padrao_movimento` text NOT NULL,
	`equipamento` text NOT NULL,
	`nivel_minimo` text NOT NULL,
	`contraindicacoes` text DEFAULT '[]' NOT NULL,
	`series_min` integer DEFAULT 2 NOT NULL,
	`series_max` integer DEFAULT 4 NOT NULL,
	`video_path` text,
	`ativo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ficha_divisao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`ficha_id` integer NOT NULL,
	`rotulo` text NOT NULL,
	`foco` text NOT NULL,
	`ordem` integer NOT NULL,
	FOREIGN KEY (`ficha_id`) REFERENCES `ficha_treino`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ficha_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`divisao_id` integer NOT NULL,
	`exercicio_id` integer NOT NULL,
	`ordem` integer NOT NULL,
	`series` integer NOT NULL,
	`reps` text NOT NULL,
	`descanso_seg` integer NOT NULL,
	`carga_orientacao` text,
	FOREIGN KEY (`divisao_id`) REFERENCES `ficha_divisao`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercicio_id`) REFERENCES `exercicio`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ficha_treino` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`aluno_id` integer NOT NULL,
	`objetivo` text NOT NULL,
	`nivel` text NOT NULL,
	`dias_por_semana` integer NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`gerada_por` text DEFAULT 'manual' NOT NULL,
	`criado_por_usuario_id` integer,
	`aprovada_por_usuario_id` integer,
	`aprovada_cref` text,
	`aprovada_em` text,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aprovada_por_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `horario_funcionamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`dia_semana` integer NOT NULL,
	`aberto` integer DEFAULT true NOT NULL,
	`abre` text,
	`fecha` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_horario_dia` ON `horario_funcionamento` (`dia_semana`);--> statement-breakpoint
CREATE TABLE `inscricao_aula` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`aula_id` integer NOT NULL,
	`aluno_id` integer NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'inscrito' NOT NULL,
	FOREIGN KEY (`aula_id`) REFERENCES `aula`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inscricao_aula_data` ON `inscricao_aula` (`aula_id`,`data`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_inscricao_aula_aluno_data` ON `inscricao_aula` (`aula_id`,`aluno_id`,`data`);--> statement-breakpoint
CREATE TABLE `log_auditoria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`usuario_id` integer,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` integer,
	`dados_antes` text,
	`dados_depois` text,
	`ip` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matricula` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`aluno_id` integer NOT NULL,
	`plano_id` integer NOT NULL,
	`data_inicio` text NOT NULL,
	`data_fim` text NOT NULL,
	`dia_ancora` integer NOT NULL,
	`valor_centavos` integer NOT NULL,
	`forma_pagamento_preferida` text,
	`status` text DEFAULT 'ativa' NOT NULL,
	`observacao` text,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plano_id`) REFERENCES `plano`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matricula_aluno` ON `matricula` (`aluno_id`,`data_fim`);--> statement-breakpoint
CREATE TABLE `mensagem_saida` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`destinatario` text NOT NULL,
	`canal` text DEFAULT 'whatsapp' NOT NULL,
	`tipo` text NOT NULL,
	`payload` text NOT NULL,
	`chave_idempotencia` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`tentativas` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mensagem_saida_chave_idempotencia_unique` ON `mensagem_saida` (`chave_idempotencia`);--> statement-breakpoint
CREATE TABLE `pagamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`cobranca_id` integer,
	`aluno_id` integer NOT NULL,
	`valor_centavos` integer NOT NULL,
	`forma` text NOT NULL,
	`data_pagamento` text NOT NULL,
	`registrado_por_usuario_id` integer,
	`observacao` text,
	FOREIGN KEY (`cobranca_id`) REFERENCES `cobranca`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pagamento_data` ON `pagamento` (`data_pagamento`);--> statement-breakpoint
CREATE TABLE `plano` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`preco_centavos` integer NOT NULL,
	`duracao_meses` integer NOT NULL,
	`descricao` text,
	`beneficios` text DEFAULT '[]' NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`destaque` integer DEFAULT false NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`token` text NOT NULL,
	`usuario_id` integer NOT NULL,
	`expira_em` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessao_token_unique` ON `sessao` (`token`);--> statement-breakpoint
CREATE TABLE `tag_restricao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`codigo` text NOT NULL,
	`rotulo` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_restricao_codigo_unique` ON `tag_restricao` (`codigo`);--> statement-breakpoint
CREATE TABLE `usuario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text,
	`papel` text NOT NULL,
	`cref` text,
	`especialidade` text,
	`telefone` text,
	`ativo` integer DEFAULT true NOT NULL,
	`ultimo_login` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_email_unique` ON `usuario` (`email`);