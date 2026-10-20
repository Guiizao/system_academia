# Marcar aluno vencido como inativo + períodos pagos do aluno
De: Claude | Para: Codex | Tamanho: M

## Objetivo
O João (áudio de 19/10) quer separar quem está vencido de quem não volta mais: na lista de alunos, marcar um vencido como inativo. E, na aba Pagamentos do aluno, ver uma linha do tempo dos meses pagos. As telas são minhas e seguem este contrato; os nomes são EXATOS.

## Escopo
- `POST /api/alunos/:id/inativar` (dono e recepção; professor recebe 403 "Professor não marca aluno como inativo"). Na MESMA transação: a matrícula `ativa` vira `encerrada` e as cobranças `aberta` do aluno viram `cancelada`. Resposta: `s.alunos.obter(id)`, já com `status: 'inativo'`. O status continua derivado: sem coluna nova e sem migração.
- Só aluno com status `vencido` → senão 400 "Só aluno vencido pode ser marcado como inativo." Aluno inexistente → 404.
- Testes: (1) vencido → inativo, sai de `?status=vencido` e entra em `?status=inativo`; a cobrança aberta é cancelada e não volta em `cobrancasAbertas()`; (2) ativo, vencendo e já inativo → 400; (3) professor → 403; (4) se ele voltar e pagar, fica `ativo` e o período começa na data do pagamento. Decida com teste o que acontece ao excluir esse pagamento de volta (hoje a exclusão reativa a última `encerrada`, e ele volta a vencido) e diga na resposta.
- `GET /api/alunos/:id/periodos` (dono e recepção) → `Array<{ dataInicio: DataISO; dataFim: DataISO }>`: as matrículas do aluno com status `ativa` ou `encerrada`, ordenadas por `dataInicio`. Teste com um pagamento de 3 períodos e uma renovação.
- NÃO mexer em `web/` nem `desktop/`. Sem dependência nova.

## Arquivos
api/src/rotas/alunos.ts e api/src/servicos/alunos.ts (ou matriculas.ts): as rotas e o serviço
api/tests/rotas/inativar-periodos.test.ts: os testes acima

## Pronto quando
- os testes acima passam; `cd api && npm test` verde; `npx tsc --noEmit -p tsconfig.json` limpo. Sem commit.

## Resposta
Resultado: feito — POST /api/alunos/:id/inativar e GET /api/alunos/:id/periodos implementados conforme o contrato, sem migração.
Validações: `npm test -- --configLoader native --pool threads` — 570/570 testes, 42/42 arquivos; 24/24 casos novos.
Validações: `npx tsc --noEmit -p tsconfig.json` — 0 erros; revisão independente dos 3 arquivos de código/testes — 0 achados.
Bloqueios: nenhum funcional. `npm test` padrão falhou antes da coleta com `spawn EPERM` no Vite; opções nativas acima resolveram sem alterar configuração.
Excluir o pagamento de volta: mantida a regra existente, coberta por teste; reativa a última matrícula encerrada e o aluno volta a vencido. A cobrança cancelada permanece cancelada.

## Revisão do servidor (Claude)
Aprovado. Transação única, regra "só vencido", 403 para professor e status continua derivado. Conferido na tela: Gustavo Lima vencido → inativo, vencidos 16 → 15.

## Revisão das telas (Codex, parcial)
O Codex bateu o limite de uso no meio (libera 21:55) e não escreveu esta seção. Antes de parar ele apontou dois defeitos, ambos confirmados e corrigidos pelo Claude, com teste:
- Enter com o foco no selo "Vencido" (ou em Pagamento/Editar da ficha) registrava check-in do aluno selecionado: o atalho agora ignora Enter em botão; numa linha focada faz o check-in daquela linha.
- Diária de 1 dia sumia da linha do tempo: o dia do vencimento passou a contar (o status só vira vencido no dia seguinte).
Pendente: revisão independente das telas no lugar do resto da revisão do Codex.

## Revisão independente das telas (no lugar do resto da do Codex)
Pediu mudanças; corrigidos pelo Claude: Enter voltou a ser do aluno destacado (só o selo e os botões da ficha ficam com o Enter; Tab numa linha a destaca); destaque e seleção juntos quando a lista encolhe; janela devolve o foco a quem abriu; janela sobre janela (Esc fecha só a de cima, contagem de janelas abertas); linha do tempo nunca começa depois de hoje; leitor de tela lê o status da linha e "pago de X a Y"; sem .at() nem Intl.ListFormat (celular antigo); z-index do selo só na lista; área de toque menor. Fechar a confirmação recarrega a lista.
Validações finais: api 570/570, web 172/172, desktop 22/22; auditoria 11 fluxos × 7 tamanhos, 77/77; pacote fora do projeto: 0.1.16 subiu em 5,1s, contagens 40/149/149/7, 5 migrações.
Pendente: o Codex revisar o diff de web/ quando a cota voltar (21:55).
