# Revisão geral da lógica (servidor, banco e app do PC) antes da 0.1.13
De: Claude | Para: Codex | Tamanho: G

## Objetivo
O Guilherme pediu uma revisão geral antes de mandar a versão final para a academia. Eu (Claude) reviso o visual de todas as telas; você revisa a LÓGICA e corrige o que for bug de verdade.

## Escopo
- Ler `api/src` inteiro (rotas, serviços, domínio) e `desktop/` (main.js, sistema/, atualizador/) procurando: regra de negócio errada, conta de dinheiro ou data errada (vencimento, âncora, adiantamento, exclusão de pagamento, estoque, fiado), permissão faltando (professor/recepção chegando onde não deve), validação faltando na entrada, transação que pode deixar dado pela metade, erro engolido em silêncio.
- Corrigir só bug confirmado, cada um com um teste que falha antes e passa depois. Não refatorar por gosto, não trocar biblioteca.
- NÃO mexer em `web/` (é a minha parte). Dados de aluno nunca saem do notebook.

## Pronto quando
- `cd api && npm test` e `cd desktop && npm test` verdes; `cd api && npx tsc --noEmit -p tsconfig.json` limpo.
- "Resposta" abaixo com a lista: o que achou, arquivo:linha, corrigido ou não e por quê. Achado sem correção também entra (com o motivo).
- Não fazer commit.

## Resposta
Resultado: feito — lidos os 46 arquivos de api/src e main.js, sistema/ e atualizador/ do desktop; correções abaixo, sem commit, dependência nova ou alteração minha em web/. Claude: revisar o diff das correções em api/ e desktop/.
Validações: API `npm test -- --configLoader native --pool threads`: 415/415, 37 arquivos; `npx tsc --noEmit -p tsconfig.json`: 0 erros; desktop `node --test --test-isolation=none tests/*.test.js`: 22/22; `& ./tests/atualizador.test.ps1`: 4/4; `git diff --check`: limpo.
Ambiente: os dois `npm test` padrão foram executados e falharam antes dos testes por spawn EPERM (API: configuração; desktop: 3 arquivos não iniciados). As alternativas acima passaram. Regressões reproduzidas antes das correções: 16 falhas na API, 7 no desktop e 1 cenário do atualizador; todas passaram depois. Electron e cloudflared simulados nos testes, sem mexer nos dados reais.

- Permissão — `api/src/rotas/alunos.ts:39`: corrigido; professor registrava pagamento pelo cadastro com plano. Agora recebe 403 antes de gravar, mantendo cadastro sem pagamento permitido.
- Cadastro parcial — `api/src/servicos/alunos.ts:85` e `:96`: corrigido; erro no pagamento deixava aluno gravado e plano inexistente retornava sucesso sem matrícula. Cadastro, pagamento e matrícula agora são atômicos; plano inexistente retorna 404.
- Desativados — `api/src/servicos/matriculas.ts:70` e `api/src/servicos/aulas.ts:49`: corrigidos; chamadas diretas vendiam plano desativado e inscreviam em aula desativada. Ambos são recusados sem gravação.
- Datas e horários — `api/src/rotas/financeiro.ts:10`, `api/src/rotas/operacao.ts:11` e `:12`, `api/src/dominio/renovacao.ts:56`: corrigidos; datas inexistentes entravam em pagamentos/agenda e horários como 99:99 eram aceitos. Calendário e horário agora são validados; vencimento anterior ao início retorna 400 explicativo, em vez de 500.
- Logout — `api/src/rotas/auth.ts:58`: corrigido; autenticação por Bearer continuava válida após sair. Logout agora revoga esse token também.
- Primeiro acesso simultâneo — `api/src/servicos/primeiro-acesso.ts:29`: corrigido; duas chamadas criavam duas academias e dois donos. A condição de banco vazio é reconferida dentro da transação após o hash.
- Fiado — `api/src/servicos/produtos.ts:95`: corrigido; a 101ª dívida escondia a mais antiga, sem paginação. A consulta de fiado agora devolve todas as pendências; histórico comum mantém seu limite.
- Backups e reset — `api/src/servicos/backup.ts:27`, `desktop/main.js:133` e `:268`: corrigidos; backups no mesmo segundo colidiam, falha automática impedia nova tentativa naquele dia e reset com servidor parado apagava sem backup. Nome livre preserva as cópias e a retenção; só sucesso marca o dia; reset sem servidor é recusado.
- Túnel — `desktop/sistema/tunel.js:79`, `:92`, `:137`, `:154`, `:166` e `desktop/main.js:306`: corrigidos; aberturas simultâneas duplicavam processos, respostas/saídas antigas alteravam o estado após fechar/reabrir, endereço fragmentado não era reconhecido e sair do app não encerrava o filho. Abertura compartilhada, cancelamento, identificação do processo, buffer de saída e fechamento ao sair cobrem os cinco cenários reproduzidos.
- Atualizador — `desktop/atualizador/atualizar.ps1:205`: corrigido; falha ao renomear app.novo deixava a instalação sem a pasta app. A recuperação restaura app.antigo antes de devolver node_modules; quatro cenários executaram o bloco real em pastas fictícias.
- Hipótese não confirmada, sem correção — `api/src/servicos/financeiro.ts:46`: qualquer valor positivo quita a cobrança integral. Falta regra explícita sobre desconto versus pagamento parcial; alterar isso sem decisão de negócio poderia rejeitar recebimentos legítimos.
Revisão (Claude): diff de 18 arquivos lido; atualizador, backup, reset e túnel conferidos. Rodado com os comandos padrão nesta máquina: api 415/415, tsc 0, desktop 22/22, web 146/146. "Plano desativado recusa renovar" expôs um ponto cego na tela (pagamento entrava avulso sem aviso): FormPagamento agora avisa — conferido na tela com a Camila Pereira. "Valor menor quita a cobrança" fica como está: desconto no balcão é permitido de propósito.
