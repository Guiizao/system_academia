CREATE TABLE `produto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`categoria` text,
	`preco_centavos` integer NOT NULL,
	`estoque` integer DEFAULT 0 NOT NULL,
	`fotos` text DEFAULT '[]' NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	CONSTRAINT "produto_estoque_valido" CHECK("produto"."estoque" >= 0 AND typeof("produto"."estoque") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `idx_produto_nome` ON `produto` (`nome`);--> statement-breakpoint
CREATE TABLE `venda` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`produto_id` integer NOT NULL,
	`aluno_id` integer,
	`cliente_nome` text,
	`quantidade` integer NOT NULL,
	`valor_unitario_centavos` integer NOT NULL,
	`total_centavos` integer NOT NULL,
	`situacao` text NOT NULL,
	`forma` text,
	`data_venda` text NOT NULL,
	`paga_em` text,
	`registrado_por_usuario_id` integer NOT NULL,
	`observacao` text,
	FOREIGN KEY (`produto_id`) REFERENCES `produto`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_venda_data` ON `venda` (`data_venda`,`id`);--> statement-breakpoint
CREATE INDEX `idx_venda_situacao_data` ON `venda` (`situacao`,`data_venda`,`id`);--> statement-breakpoint
CREATE INDEX `idx_venda_produto` ON `venda` (`produto_id`);