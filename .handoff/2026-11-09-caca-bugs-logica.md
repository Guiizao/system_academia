# Caça a bugs de lógica no servidor
De: Claude | Para: Codex | Tamanho: M

## Objetivo
O Guilherme pediu uma varredura de quebras de lógica. O servidor é seu: achar defeitos reais nas regras de dinheiro e de acesso, provar cada um com teste que falha e corrigir.

## Escopo
- Ler `api/src/servicos/` e `api/src/rotas/` atrás de: dinheiro somado ou contado duas vezes (receita do mês, caixa, relatórios, dashboard com pagamentos editados ou excluídos e com vendas recebidas junto da mensalidade), cobrança que nasce ou some errado (inativar, excluir pagamento, diária), datas na virada de mês e de ano, fuso (UTC × America/Sao_Paulo) e dia 31, check-in de aluno desativado, permissão (professor e recepção chegando a algo do dono), venda com estoque negativo ou cancelada depois de paga, importação por pasta repetida.
- Só corrigir o que tiver teste que falha antes. O que não for defeito, mas for melhoria, vai listado na Resposta (no máximo 5, com o porquê), sem implementar.
- NÃO mexer em `web/` nem `desktop/`. Sem dependência nova. Sem migração, a menos que o defeito exija (diga por quê).

## Pronto quando
- Cada defeito com teste em `api/tests/` e a correção; `cd api && npm test` verde (se der `spawn EPERM`, `-- --configLoader native --pool threads`) e `npx tsc --noEmit -p tsconfig.json` limpo. Sem commit.

## Resposta
Resultado: feito — 3 defeitos corrigidos, 11 testes novos; alterações somente em api/ e neste handoff. Sem dependências, migrações ou commit; transações continuam síncronas.
Prova antes da correção: arquivo novo com 9 casos executado contra o código original: 7 falhando e 2 passando (check-in: recebeu 201 em vez de 400; professor: 200 em vez de 403; exclusão: cobrança de R$ 90 reapareceu).
Prova depois da correção: os mesmos 9 casos passaram; execução dirigida com testes existentes: 61/61 passando em 5 arquivos. Acrescentados 2 controles de conciliação/importação, totalizando 11 novos.
Validação final: `cd api; npm.cmd test` — 599 passando, 0 falhando, 44/44 arquivos; `npx.cmd tsc --noEmit -p tsconfig.json` — saída 0, 0 erros de tipo. `git diff --check` sem erros.
Ambiente: PowerShell bloqueou npm.ps1; usados npm.cmd/npx.cmd equivalentes. Suíte final passou sem fallback; prova dirigida usou `--configLoader native --pool threads`.
Defeitos (arquivo:linha, cenário, teste; testes abaixo em api/tests/rotas/caca-bugs-logica.test.ts):
- `api/src/servicos/checkins.ts:15`: cadastro desativado conseguia registrar entrada; agora recusa sem gravar. Teste: linha 89, nos 3 perfis.
- `api/src/rotas/alunos.ts:57`: professor revertia exclusão lógica com ativo=true; agora não altera ativação do cadastro. Teste: linha 100; controles para dono/recepção na linha 110.
- `api/src/servicos/financeiro.ts:150`: excluir pagamento reabria cobrança após desativação do cadastro ou inativação da matrícula; agora cancela a cobrança desquitada nesses casos. Testes: linhas 120 (vínculo explícito/implícito) e 133 (avulso após inativação).
Conferências adicionais: linha 31 concilia receita/caixa/histórico/relatório/painel após edição na virada do ano, cancelamento de venda paga e exclusão; linha 58 comprova repetição por pasta sem duplicação. Receita de mensalidades continua sem produtos, conforme contrato existente; demais testes de estoque, permissões, diária, fuso e dia 31 passaram na suíte.
Melhorias sugeridas (não implementadas): documentar explicitamente nos contratos da API a separação entre receita de mensalidades e produtos, para evitar futuras somas indevidas; centralizar a extração do token de sessão, hoje repetida entre rotas e plugin, para reduzir divergências futuras.
Bloqueios: nenhum para implementação/validação. Revisão cruzada do diff pelo Claude permanece para o retorno do handoff.

## Revisão (Claude)
Aprovado. Os três defeitos têm teste e a correção é mínima: professor não muda `ativo` (nem reativa), check-in recusa cadastro desativado, e a cobrança desquitada volta cancelada quando o cadastro ou a matrícula não estão ativos (cancelada continua cancelada). Melhorias listadas ficam para decidir com o Guilherme.
