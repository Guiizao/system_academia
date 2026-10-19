CREATE TABLE `pagamento_alteracao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pagamento_id` integer NOT NULL,
	`aluno_id` integer NOT NULL,
	`acao` text NOT NULL,
	`usuario_id` integer,
	`em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`antes` text NOT NULL,
	`depois` text,
	FOREIGN KEY (`aluno_id`) REFERENCES `aluno`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pagamento_alteracao_pagamento_em` ON `pagamento_alteracao` (`pagamento_id`,`em`);--> statement-breakpoint
ALTER TABLE `pagamento` ADD `periodos` integer;
--> statement-breakpoint
-- O vínculo legado repete a associação usada pelo serviço financeiro.
UPDATE pagamento SET periodos = (
  SELECT CASE WHEN plano.duracao_dias IS NOT NULL THEN 1 ELSE
    CAST(max(1, round((
      (CAST(strftime('%Y', matricula.data_fim) AS INTEGER) - CAST(strftime('%Y', matricula.data_inicio) AS INTEGER)) * 12
      + CAST(strftime('%m', matricula.data_fim) AS INTEGER) - CAST(strftime('%m', matricula.data_inicio) AS INTEGER)
    ) / (max(1, plano.duracao_meses) * 1.0))) AS INTEGER)
  END
  FROM matricula INNER JOIN plano ON plano.id = matricula.plano_id
  WHERE matricula.id = coalesce(pagamento.matricula_id,
    (SELECT candidata.id FROM matricula candidata
      WHERE candidata.aluno_id = pagamento.aluno_id
        AND candidata.criado_em >= pagamento.criado_em
        AND candidata.criado_em <= strftime('%Y-%m-%dT%H:%M:%fZ', pagamento.criado_em, '+60 seconds')
        AND NOT EXISTS (SELECT 1 FROM pagamento vinculado WHERE vinculado.matricula_id = candidata.id)
      ORDER BY (candidata.id = (SELECT atual.id FROM matricula atual
        WHERE atual.aluno_id = candidata.aluno_id AND atual.status = 'ativa'
        ORDER BY atual.data_fim DESC LIMIT 1)) DESC, candidata.id DESC LIMIT 1))
);
