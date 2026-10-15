# Histórico de pagamentos, editar pagamento e busca sem acento (backend)
De: Claude | Para: Codex | Tamanho: G

## Objetivo
O dono quer ver TODOS os pagamentos de cada mês (lista + gráfico + busca), editar um pagamento pela ficha do aluno (data, valor, plano, com a senha e recálculo do vencimento) e achar "José" digitando "jose". A tela é minha e segue este contrato; nomes de campo EXATOS.

## Escopo
- `PagamentoDetalhe` = Pagamento + `alunoNome`, `matriculaId|null`, `planoId|null`, `planoNome|null`, `alteraVencimento: boolean` (true se este pagamento gerou a matrícula ATIVA atual do aluno; mesma regra/legado de 60 s do excluir).
- `GET /api/alunos/:id/pagamentos` passa a devolver `PagamentoDetalhe[]`.
- `GET /api/pagamentos/historico?mes=YYYY-MM&busca=texto` (dono, recepcao) → `{ itens: PagamentoDetalhe[], totalCentavos, quantidade, porForma: {forma,totalCentavos,quantidade}[], porDia: {data,totalCentavos}[], meses: {mes,totalCentavos,quantidade}[] }`. Com `mes`: o mês inteiro, sem limite, mais recente primeiro. Só `busca`: todos os meses, por nome do aluno, limite 500. Os dois: interseção. `meses` = últimos 12 meses, do mais antigo ao atual (sempre). `porDia` só com `mes`.
- `PUT /api/pagamentos/:id` (dono) `{ senha, dataPagamento?, valorCentavos?, forma?, planoId?, periodos?, observacao? }`, senha como no excluir. Se `alteraVencimento`: numa transação desfaz a renovação (igual ao excluir) e refaz com os dados novos, mantendo o mesmo id. Se não: só valor/forma/observação; mudar data/plano → 400 "Esse pagamento tem renovação depois dele: só dá para mudar valor, forma e observação." Avulso (sem matrícula): edita tudo. Resposta `{ ok: true, pagamento: PagamentoDetalhe, dataFimNova: string|null }`.
- Busca sem acento e sem diferença de maiúscula em `GET /api/alunos?busca=` ("jose"→"José", "conceicao"→"Conceição") e na `busca` do histórico. Telefone continua igual.
- NÃO mexer em `web/`. Sem dependência nova.

## Pronto quando
- testes: editar data do último pagamento recalcula o vencimento; trocar plano recalcula; editar só valor; recusa mudar data quando há renovação depois; senha errada; recepção 403 no PUT; busca "jose" acha "José"; histórico soma o mês certo e a busca atravessa meses.
- `cd api && npm test` verde e `npx tsc --noEmit -p tsconfig.json` limpo. Sem commit.

## Resposta
Resultado: feito; rotas e campos do contrato preservados, sem dependências novas e sem commit.
Implementado: PagamentoDetalhe, histórico mensal/busca, edição transacional com senha e busca sem acento.
Reuso: associação legada de 60 s e desfazimento compartilhados com excluir; confirmarSenha e renovarEm/calcularPeriodo existentes.
Validações: `cd api; npm test -- --configLoader native --pool threads` — 481/481 testes, 38/38 arquivos; 66 testes novos.
Validações: `cd api; npx tsc --noEmit -p tsconfig.json` — passou, 0 erros.
Ambiente: `npm test` padrão falhou com spawn EPERM no carregamento da configuração; usada a alternativa autorizada acima.
Histórico: sem filtros usa o mês atual; meses sempre traz os últimos 12 meses globais; porDia vazio na busca sem mês.
Arquivos: api/src/db/{busca,client}.ts; api/src/rotas/financeiro.ts; api/src/servicos/{alunos,financeiro}.ts; api/tests/servicos/historico-editar-busca.test.ts.
Revisão cruzada: diff da API disponível para o Claude; web/ e desktop/ não foram alterados por mim.
Bloqueios: nenhum; nenhum desvio de campos ou rotas do contrato.

## Revisão (Claude)
Aprovado com 1 correção: editar só valor/forma/observação do último pagamento refazia a matrícula e apagava a cobrança em aberto do período. Agora só data, plano ou períodos refazem; teste novo cobre (482/482).
Conferido no navegador: busca "jose"/"conceicao"; mudar data do último pagamento 10/10→20/10 leva o vencimento a 20/11 e volta; pagamento antigo recusa data; senha errada recusada; excluir devolve o vencimento.
