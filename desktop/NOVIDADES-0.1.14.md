# DARK FISIC 0.1.14 — histórico completo e editar pagamento

## O que tem de novo

- **Histórico de pagamentos no Financeiro.** Todos os pagamentos de cada mês,
  sem o corte de 30 de antes. Um gráfico com os últimos 12 meses: toque numa
  barra para abrir aquele mês, ou use as setas. Mostra o total do mês e quanto
  entrou por Pix, dinheiro, débito e crédito.
- **Buscar quem pagou.** A busca do histórico procura o aluno em todos os
  meses de uma vez: "esse aluno pagou quando?".
- **Editar pagamento (só o dono, com a senha).** Lápis ao lado de cada
  pagamento, na ficha do aluno e no histórico. Dá para corrigir a data, o
  valor, a forma, o plano e a observação. Mudar a data ou o plano recalcula o
  vencimento sozinho, pela mesma regra do pagamento normal.
  Se o aluno já pagou de novo depois, o pagamento antigo só deixa corrigir
  valor, forma e observação: mudar a data embaralharia os meses seguintes.
- **Excluir pela ficha do aluno também**, com a senha, como já era no Financeiro.
- **Busca sem acento.** "jose" acha "José", "conceicao" acha "Conceição". Vale
  para alunos, histórico, cobranças e loja.
- **Busca nas cobranças em aberto.**

## Correções

- O olho de esconder valores não fica mais em cima dos números e nomes (aba
  Pagamentos do aluno e relatório do mês).
- Os nomes das cobranças não ficam mais colados na borda da caixa.
- O botão "Fiado (a receber)" e os botões azuis não têm mais o brilho cortado
  em quadrado com o efeito Neon.
- Os cartões do topo do Financeiro (recebido no mês, ticket médio) se
  atualizam na hora depois de receber, editar ou excluir um pagamento.
- Campo travado agora parece travado (apagado, borda tracejada).
- Celular pequeno: a aba "Histórico" da ficha do aluno não sai mais da tela.

Conferido em 9 telas × 7 tamanhos (celular em pé e deitado, tablet, notebook e
monitor). Testes: 482 do servidor, 150 da tela, 22 do app de PC.
