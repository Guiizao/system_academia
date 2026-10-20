# DARK FISIC 0.1.16 — meses pagos e aluno inativo

Os dois pedidos do João nos áudios de 19/10.

## Meses pagos, na aba Pagamentos do aluno

Uma linha com os meses lado a lado. O verde ocupa os dias que o aluno pagou:
quem pagou até janeiro aparece com outubro, novembro, dezembro e janeiro
verdes. Quem vence no dia 5 aparece com um pedacinho verde no mês seguinte.

- **Listrado em vermelho:** o trecho entre o vencimento e hoje, para quem está
  vencido.
- **Risco branco:** onde fica hoje.
- Em cima, à direita: "Pago até 24/05/2027" ou "Venceu em 04/10/2026".
- Mostra até 3 meses para trás e tudo o que já está pago para a frente, no
  máximo 12 meses.

## Marcar um vencido como inativo

Na lista de alunos, o selo **Vencido** virou botão (o mesmo no topo da ficha
do aluno). Ele abre uma confirmação:

- o aluno sai dos vencidos e vai para o filtro **Inativos**;
- a cobrança em aberto dele é cancelada;
- pagamentos, check-ins e avaliações continuam guardados.

Se ele voltar, é só registrar o pagamento: o plano recomeça no dia em que ele
pagar. Só o dono e a recepção veem o botão. Ativo e "a vencer" não mudam por
aqui: quem decide esses é o pagamento.

## Correções

- **Enter registrava check-in sem querer.** Com a ficha do aluno aberta no PC,
  apertar Enter num campo da janela Editar, em qualquer outra janela ou num
  botão da ficha (Pagamento, Editar) registrava um check-in do aluno
  selecionado na lista. Agora o Enter nesses lugares é só do botão ou da
  janela; na busca e na lista ele continua fazendo o check-in de quem está
  destacado.
- **Janela por cima de janela, no celular:** o Esc fechava as duas de uma vez e
  o fundo voltava a rolar. Agora fecha só a de cima.
- Ao fechar uma janela, o foco do teclado volta para o botão que a abriu.

Conferido em 7 tamanhos (celular em pé e deitado, tablet, notebook e
monitor).
