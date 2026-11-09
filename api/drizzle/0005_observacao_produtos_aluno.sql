ALTER TABLE `aluno` ADD `observacao` text;
--> statement-breakpoint
ALTER TABLE `venda` ADD `pagamento_id` integer REFERENCES `pagamento`(`id`);
