# DARK FISIC 0.1.18 — revisão de bugs

Varredura de defeitos com dados no limite: nome de aluno com 70 letras,
produto com nome comprido comprado 12 vezes, observação de 500 letras com um
link, valores na casa dos milhares, em 7 tamanhos de tela.

## Regras corrigidas

- **Aluno desativado conseguia fazer check-in.** Agora o sistema recusa.
- **Professor conseguia reativar um aluno desativado** (desativar ele já não
  podia). Agora só o dono e a recepção mexem nisso.
- **Excluir um pagamento de quem já saiu fazia a dívida voltar.** Se o aluno
  foi desativado ou marcado como inativo, a cobrança volta cancelada, não em
  aberto.

## Texto e tela

- Na ficha, o nome do produto devido aparecia cortado até sobrar uma letra no
  celular. Agora o nome aparece inteiro e o "Receber…" fica embaixo dele.
- Nome de plano comprido no histórico da ficha quebra linha em vez de virar
  reticência.
- O ícone das faixas vermelhas (vencido, devendo na loja) encolhia até virar um
  pontinho quando o texto era longo.
- No celular, a faixa amarela da observação ficava mais estreita que as outras.
- O telefone não quebra mais no meio ("(11) 9" numa linha e o resto na outra).

Conferido em 16 telas × 7 tamanhos (celular em pé e deitado, tablet, notebook e
monitor).
