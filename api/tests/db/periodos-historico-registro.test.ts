import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { abrirBanco } from '../../src/db/client.js';

let fechar: (() => void) | undefined;
afterEach(() => fechar?.());
const pasta = join(process.cwd(), 'drizzle');

function bancoLegado() {
  const t = abrirBanco(':memory:');
  fechar = () => t.sqlite.close();
  t.sqlite.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)');
  for (const migracao of readMigrationFiles({ migrationsFolder: pasta }).slice(0, 4)) {
    for (const sql of migracao.sql) t.sqlite.exec(sql);
    t.sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
      .run(migracao.hash, migracao.folderMillis);
  }
  return t;
}

describe('migração 0004: períodos e registro de alterações', () => {
  it('infere períodos dos pagamentos antigos e preserva todas as contagens', () => {
    const { sqlite, db } = bancoLegado();
    sqlite.exec(`
      INSERT INTO plano (id, nome, preco_centavos, duracao_meses, duracao_dias) VALUES
        (1, 'Mensal', 10000, 1, NULL), (2, 'Trimestral', 27000, 3, NULL), (3, 'Diária', 2000, 0, 1);
      INSERT INTO aluno (id, nome, telefone) VALUES
        (1, 'Mensal antigo', '1'), (2, 'Trimestral antigo', '2'), (3, 'Diária antiga', '3'),
        (4, 'Vínculo por horário', '4'), (5, 'Avulso', '5'), (6, 'Vencimento curto', '6'),
        (7, 'Vencimento manual', '7'), (8, 'Fora da janela', '8');
      INSERT INTO matricula (id, aluno_id, plano_id, data_inicio, data_fim, dia_ancora, valor_centavos, criado_em, status) VALUES
        (1, 1, 1, '2026-01-31', '2026-03-31', 31, 20000, '2026-01-01T10:00:00.000Z', 'ativa'),
        (2, 2, 2, '2025-11-30', '2026-05-31', 30, 54000, '2026-01-01T10:00:00.000Z', 'ativa'),
        (3, 3, 3, '2026-01-01', '2026-01-02', 1, 2000, '2026-01-01T10:00:00.000Z', 'ativa'),
        (4, 4, 1, '2026-01-10', '2026-04-10', 10, 30000, '2026-01-01T10:00:30.000Z', 'ativa'),
        (5, 4, 1, '2026-01-10', '2026-02-10', 10, 10000, '2026-01-01T10:00:40.000Z', 'encerrada'),
        (6, 6, 1, '2026-01-10', '2026-01-20', 10, 10000, '2026-01-01T10:00:00.000Z', 'ativa'),
        (7, 7, 2, '2026-01-10', '2026-06-10', 10, 54000, '2026-01-01T10:00:00.000Z', 'ativa'),
        (8, 8, 1, '2026-01-10', '2026-04-10', 10, 30000, '2026-01-01T10:01:01.000Z', 'ativa');
      INSERT INTO pagamento (id, aluno_id, matricula_id, valor_centavos, forma, data_pagamento, criado_em) VALUES
        (1, 1, 1, 20000, 'pix', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (2, 2, 2, 54000, 'pix', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (3, 3, 3, 2000, 'dinheiro', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (4, 4, NULL, 30000, 'pix', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (5, 5, NULL, 1000, 'credito', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (6, 6, 6, 10000, 'pix', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (7, 7, 7, 54000, 'pix', '2026-01-01', '2026-01-01T10:00:00.000Z'),
        (8, 8, NULL, 30000, 'pix', '2026-01-01', '2026-01-01T10:00:00.000Z');
      INSERT INTO cobranca (aluno_id, matricula_id, competencia, valor_centavos, vencimento)
        VALUES (1, 1, '2026-03', 10000, '2026-03-31');
    `);
    const tabelas = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'")
      .all() as { name: string }[];
    const contagens = () => Object.fromEntries(tabelas.map(({ name }) => [name,
      sqlite.prepare(`SELECT count(*) AS total FROM "${name}"`).get(),
    ]));
    const antes = contagens();

    migrate(db, { migrationsFolder: pasta });

    expect(sqlite.prepare('SELECT periodos FROM pagamento ORDER BY id').all())
      .toEqual([2, 2, 1, 3, null, 1, 2, null].map((periodos) => ({ periodos })));
    expect(contagens()).toEqual(antes);
    expect(sqlite.prepare('SELECT count(*) AS total FROM pagamento_alteracao').get()).toEqual({ total: 0 });
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    // A mesma migração não pode ser reaplicada ao reiniciar o servidor.
    migrate(db, { migrationsFolder: pasta });
    expect(contagens()).toEqual(antes);
  });

  it('mantém o registro de exclusão depois de apagar o pagamento', () => {
    const { sqlite, db } = bancoLegado();
    migrate(db, { migrationsFolder: pasta });
    sqlite.exec(`
      INSERT INTO aluno (id, nome, telefone) VALUES (1, 'Aluno de teste', '1');
      INSERT INTO pagamento (id, aluno_id, valor_centavos, forma, data_pagamento)
        VALUES (1, 1, 1000, 'pix', '2026-01-01');
    `);
    const antes = { dataPagamento: '2026-01-01', valorCentavos: 1000, forma: 'pix',
      planoNome: null, periodos: null, observacao: null };
    sqlite.prepare('INSERT INTO pagamento_alteracao (pagamento_id, aluno_id, acao, antes) VALUES (?, ?, ?, ?)')
      .run(1, 1, 'excluiu', JSON.stringify(antes));
    sqlite.prepare('DELETE FROM pagamento WHERE id = ?').run(1);
    const registro = sqlite.prepare('SELECT pagamento_id, acao, usuario_id, em, antes, depois FROM pagamento_alteracao').get();
    expect(registro).toEqual({ pagamento_id: 1, acao: 'excluiu', usuario_id: null,
      em: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), antes: JSON.stringify(antes), depois: null });
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('registra a 0004 no journal gerado pelo Drizzle', () => {
    const journal = JSON.parse(readFileSync(join(pasta, 'meta', '_journal.json'), 'utf8'));
    expect(journal.entries.length).toBeGreaterThanOrEqual(5);
    expect(journal.entries[4]).toMatchObject({ idx: 4, tag: '0004_periodos_historico_registro', breakpoints: true });
    expect(journal.entries[4].when).toBeGreaterThan(journal.entries[3].when);
    expect(readMigrationFiles({ migrationsFolder: pasta })).toHaveLength(journal.entries.length);
  });
});
