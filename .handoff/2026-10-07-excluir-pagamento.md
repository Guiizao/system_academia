# Excluir pagamento com senha do dono e recalcular o vencimento
De: Claude | Para: Codex | Tamanho: M

## Objetivo
O João registrou o mesmo pagamento duas vezes e o vencimento do aluno andou dois períodos. O dono precisa excluir um pagamento, confirmando com A PRÓPRIA senha, e o vencimento tem de voltar a ser o de antes.

## Escopo
- `DELETE /api/pagamentos/:id`, só papel `dono`. Body `{ senha: string }` (zod). Senha errada → 400 "Senha incorreta." (reusar a verificação argon2 de `servicos/auth.ts` e o limitador de `dominio/limitador.ts`).
- Nova coluna `pagamento.matricula_id` (nullable) gravada em `registrarPagamento` (`servicos/financeiro.ts`) + migration drizzle.
- Desfazer, numa transação só: apaga o pagamento; se ele gerou a matrícula ATIVA atual do aluno, apaga essa matrícula, volta a anterior (última `encerrada`) para `ativa` e reabre a cobrança que ele quitou (`cobrancaId`, e as da matrícula anterior que ficaram `paga` sem pagamento apontando).
- Pagamento antigo sem `matricula_id`: tratar como ligado à matrícula ativa do aluno criada até 60 s depois dele.
- Se a matrícula do pagamento NÃO é a atual (há renovação depois): recusar 400 "Exclua primeiro o pagamento mais recente deste aluno."
- Resposta 200: `{ ok: true, alunoId, dataFimNova: string | null }`.
- NÃO mexer em `web/`.

## Pronto quando
- testes novos em `api/tests/servicos/excluir-pagamento.test.ts`: pagamento duplicado → excluir o 2º → vencimento volta ao do 1º; senha errada recusa; recepção recusa (403); pagamento antigo recusa com a mensagem.
- `cd api && npm test` todo verde; `npx tsc --noEmit` limpo.

## Resposta
Resultado: feito — exclusão com a própria senha, limite de tentativas e restauração transacional da matrícula/cobranças; legado de até 60 s coberto.
Validações: npm test -- --configLoader native --pool threads: 304/304 (23 novos); npx tsc --noEmit -p tsconfig.json: sem erros.
Validações: migration 0002 gerada por npx drizzle-kit generate usando cópia temporária do schema compilada em CommonJS.
Bloqueios: nenhum; opções locais de execução contornaram spawn EPERM, sem instalar dependências.
Revisão (Claude): caso do João pela tela — vencia 13/10, pago → 13/11, clique em dobro → 13/12; senha errada recusa; excluir o antigo recusa; excluir o duplicado volta para 13/11.
