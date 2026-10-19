# Pagamento: guardar períodos, histórico completo com filtros, registro de alterações
De: Claude | Para: Codex | Tamanho: G

## Objetivo
Bug confirmado: pagou 2 meses (vence 10/12), corrigir só a data leva o vencimento para 11/11, o aluno perde 1 mês (trocar plano também zera para 1). Além disso o dono quer ver TODOS os pagamentos numa tabela com filtros e saber quem editou ou excluiu cada um. A tela é minha e segue este contrato; nomes EXATOS.

## Escopo
- Migração `0004`: `pagamento.periodos integer` (null = avulso). Registrar grava o número usado. Legado: deduzir pela matrícula (meses entre início e fim ÷ duração do plano, mínimo 1; diária = 1).
- `PUT /api/pagamentos/:id` sem `periodos` MANTÉM os períodos gravados (data, plano ou só valor). Teste do caso acima: continua vencendo 2 períodos depois.
- `PagamentoDetalhe` ganha `periodos: number|null`, `registradoPorNome: string|null`, `editado: boolean`.
- `GET /api/pagamentos/historico` aceita `mes` | `de`+`ate` (AAAA-MM-DD) | nada = todos; mais `busca`, `forma`, `planoId`, `pagina` (1..), `porPagina` (padrão 50, máx 200). Resposta atual + `pagina, porPagina, totalPaginas`; `totalCentavos`, `quantidade`, `porForma` valem para o conjunto filtrado inteiro, `itens` só a página. Sai o limite de 500. `meses` (12) igual.
- Tabela `pagamento_alteracao` (pagamentoId, alunoId, acao 'editou'|'excluiu', usuarioId, em, antes json, depois json|null), gravada na MESMA transação do PUT/DELETE. `GET /api/pagamentos/alteracoes?pagamentoId=&limite=50` (só dono) → `[{ id, acao, em, usuarioNome, alunoNome, pagamentoId, antes, depois }]`, antes/depois = `{ dataPagamento, valorCentavos, forma, planoNome, periodos, observacao }`.
- Regras: data de pagamento no futuro → 400 "A data do pagamento não pode ser depois de hoje." (registrar e editar). Revise as outras bordas de editar data (antes do pagamento anterior do aluno, diária agendada, vencimento manual) e decida com teste; liste o que decidiu na resposta.
- NÃO mexer em `web/` nem `desktop/`. Sem dependência nova.

## Pronto quando
- testes dos itens acima, incluindo a migração num banco com pagamentos antigos (contagens iguais depois);
- `cd api && npm test` verde e `npx tsc --noEmit -p tsconfig.json` limpo. Sem commit.

## Resposta
(Preenchida pelo Claude: o Codex fez o trabalho e passou nos testes, mas bateu o limite de uso antes de escrever esta parte.)
Resultado: feito pelo Codex; o adendo da recepção foi feito pelo Claude, com teste.
Validações: `cd api && npx vitest run` 546 de 546; `npx tsc --noEmit -p tsconfig.json` 0 erros.
Decisões de borda (pelo código e testes do Codex): data no futuro recusada ao registrar e ao editar; editar a data para antes do pagamento anterior do aluno é recusado; diária marcada para outro dia mantém o dia; vencimento manual do legado é mantido quando só a data muda; legado com mais de 12 períodos é preservado ao editar.
Arquivos: api/drizzle/0004_*; api/src/db/schema.ts; api/src/rotas/financeiro.ts; api/src/servicos/{financeiro,matriculas}.ts; testes em api/tests/{db,rotas,servicos}/periodos-*.

## Revisão (Claude)
Aprovado. Conferido no navegador: corrigir de 1 para 2 meses leva o vencimento de 11/11 a 11/12; mudar só a data mantém os 2 meses (12/12); data futura recusada; registro mostra quem editou com antes e depois; recepção sem totais.

## Adendo (Claude, mesmo dia)
- Regra antiga do sistema: recepção NÃO recebe números consolidados do caixa. No `GET /api/pagamentos/historico`, para quem não é dono, `totalCentavos`, `porForma`, `porDia` e `meses` saem da resposta (os campos ficam ausentes); `itens`, `quantidade` e paginação continuam. Teste: recepção não recebe esses campos; dono recebe.

## Revisão da tela (revisor independente; o Codex estava sem cota)
12 achados (4 médios, 8 baixos), todos corrigidos: Esc na busca não volta mais ao resumo; página ajusta depois de excluir; busca por nome volta a valer para todos os meses e "Ver todos" abre em Todos; datas do registro no horário local; contagem sem piscar; reordenar planos atualiza o resumo; opção de mais de 12 períodos; rótulo de tempo pago igual nos dois lugares; Treinos espera os nomes; Agenda sem esqueleto por cima da lista; foco vai para o "voltar"; boneco não comemora exclusão, cancelamento nem desativação.
Pendente: o Codex revisar o diff de web/ quando a cota voltar.
