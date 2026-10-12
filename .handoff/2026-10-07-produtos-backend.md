# Produtos e vendas (backend)
De: Claude | Para: Codex | Tamanho: G

## Objetivo
Loja da academia: cadastrar produto (com até 3 fotos), controlar estoque e vender, para aluno ou cliente avulso, paga ou fiado. A tela é minha e já está sendo feita contra o contrato abaixo.

## Escopo (contrato — os nomes de campo são EXATOS, a tela depende deles)
- Tabela `produto`: id, nome, descricao?, categoria?, precoCentavos, estoque (int ≥0), fotos (JSON: array de até 3 data URLs `data:image/jpeg;base64,...`, cada uma ≤ 400 KB), ativo. Tabela `venda`: id, produtoId, alunoId?, clienteNome?, quantidade, valorUnitarioCentavos, totalCentavos, situacao `'paga'|'fiado'`, forma? (`pix|dinheiro|credito|debito`, nula se fiado), dataVenda (ISO data), pagaEm?, registradoPorUsuarioId, observacao?. Migration drizzle.
- `GET /api/produtos` (dono, recepcao) → `Produto[]` ativos em ordem de nome; `?todos=1` inclui inativos (só dono).
- `POST /api/produtos` e `PUT /api/produtos/:id` (dono). `DELETE /api/produtos/:id` (dono): sem vendas apaga; com vendas desativa.
- `GET /api/vendas?situacao=fiado|paga` (dono, recepcao) → `Venda[]` mais recentes primeiro, limite 100, com `produtoNome` e `alunoNome` (null se avulso).
- `POST /api/vendas` (dono, recepcao) `{ produtoId, quantidade, alunoId?, clienteNome?, situacao, forma? }`: total = preço×qtd, baixa o estoque; estoque insuficiente → 400 "Só tem N em estoque."; exige alunoId OU clienteNome quando fiado.
- `POST /api/vendas/:id/receber` `{ forma }` → fiado vira paga, pagaEm = hoje.
- `DELETE /api/vendas/:id` (dono) `{ senha }`, mesma checagem de senha do handoff `2026-10-07-excluir-pagamento.md`: cancela e DEVOLVE ao estoque.
- Venda NÃO entra na receita de mensalidade (`receitaDoMes`): fica separada. NÃO mexer em `web/`.

## Pronto quando
- testes em `api/tests/servicos/produtos.test.ts` e rotas: estoque baixa e devolve, estoque insuficiente recusa, fiado → receber, permissões (professor 403), foto grande recusada.
- `cd api && npm test` verde e `npx tsc --noEmit` limpo.

## Resposta
Resultado: feito pelo Codex até o limite de uso do plano (parou antes de preencher esta resposta); revisado e fechado pelo Claude.
Validações: cd api && npx vitest run → 398/398; npx tsc --noEmit limpo; fluxo pela tela com sessão do dono: venda fiada 2× baixa estoque 5→3, venda acima do estoque recusa ("Só tem 3 em estoque."), fiado sem nome recusa, receber → paga com data de hoje, cancelar com senha devolve ao estoque.
Revisão: total calculado no servidor pelo preço do banco; estoque baixa por SQL dentro da transação; validação zod no serviço (as rotas repassam o corpo).
Bloqueios: nenhum. Pasta api/.temporario-migracao (sobra da geração da migration) apagada.
