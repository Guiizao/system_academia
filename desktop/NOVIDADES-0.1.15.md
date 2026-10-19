# DARK FISIC 0.1.15 — telas em resumo, pagamentos completos e visual renovado

## Cada tela abre no resumo

O Financeiro e os Treinos mostram primeiro um pouco de cada coisa, sem
repetir nada, e cada assunto tem o botão para o painel completo dele. O botão
"‹ Financeiro" (ou o Esc) volta.

- **Financeiro:** os números do mês, a receita dos últimos 12 meses (toque numa
  barra para abrir o mês), as 4 cobranças mais atrasadas, os últimos
  pagamentos e os planos com quantos alunos tem em cada um.
- **Treinos:** cada ficha virou um cartão curto (de quem é, objetivo, nível,
  treinos A e B, quantos exercícios). A ficha inteira e o botão de liberar
  abrem num clique. Busca por aluno.

## Pagamentos: tudo, numa tabela

- **Todos os pagamentos:** por mês ou de todos os tempos, com busca por aluno
  (sem acento), forma e plano, e páginas de 50. O total vale para o filtro
  inteiro.
- **Mostra o que cada pagamento cobriu:** "Plus, 2 meses", e quem registrou.
- **Editar e excluir em cada linha,** com a senha do dono.
- **Corrigir o tempo pago:** a janela de editar abre marcando quantos meses
  foram pagos. Se a pessoa pagou 2 e foi marcado 1, troca ali e o vencimento
  anda sozinho.
- **Registro de alterações:** quem editou ou excluiu qual pagamento, quando, e
  o antes e o depois de cada campo. Pagamento editado ganha o selo "editado".

## Correções de lógica

- **Corrigir só a data de um pagamento de 2 meses tirava 1 mês do aluno.**
  Agora o sistema guarda quantos meses foram pagos e mantém ao editar. Os
  pagamentos antigos tiveram o número deduzido pela matrícula.
- **Data de pagamento no futuro** é recusada, ao registrar e ao editar.
- **A recepção não recebe mais os totais do caixa** no histórico (regra do
  sistema que o histórico da 0.1.14 furava).
- **Atalhos do Início:** "Novo aluno" abre o cadastro e "Check-in" vai direto
  para a busca. Antes os dois só abriam a tela de Alunos.

## Visual e animações

- Títulos maiores, cartões com leve relevo nos temas escuros e carregamento
  em barras que brilham, no lugar do "Carregando…".
- Os números contam até o valor e, quando mudam (pagamento entrou ou saiu),
  andam do valor antigo até o novo.
- O painel completo entra pela lateral.
- Títulos e cartões alinhados na mesma coluna em todas as telas (em Produtos e
  na Agenda o título ficava para dentro).
- Preço dos planos não quebra mais no meio ("/3" numa linha e "meses" na outra).

## Bonequinho

- Aparece também no **celular** (na barra de cima) e no **tablet** (na lateral).
- **Comemora** quando algo dá certo (pagamento, check-in, edição salva): larga
  o aparelho, pula de braços para cima e volta ao treino.
- Ganhou sombra no chão, que encolhe no pulo, e uma faixa azul na testa.

Conferido em 16 telas × 7 tamanhos (celular em pé e deitado, tablet, notebook
e monitor). Testes: 546 do servidor, 154 da tela, 22 do app de PC.
