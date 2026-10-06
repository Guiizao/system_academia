# DARK FISIC 0.1.9

## Mensalidade: quem paga adiantado não perde dia

O João perguntou se, pagando dia 6 com vencimento dia 10, o sistema não estaria
encurtando o mês. A conta já estava certa — o período novo sempre emendou no
vencimento antigo —, mas **a tela não mostrava isso** e a nota do formulário
dizia justamente o contrário.

Agora, antes de confirmar, aparece em destaque:

> **Novo vencimento**
> 10/11/2026
> Vencia 10/10/2026. Os 4 dias que faltavam entraram no período novo —
> pagar adiantado não encurta o mês.

Esse número vem do servidor, da mesma função que grava. O que você lê é o que
vai ser gravado.

A regra, por escrito:

| Quando paga | O que acontece |
|---|---|
| Antes de vencer | Emenda no vencimento atual. Não perde dia nenhum. |
| No dia | Igual: emenda no vencimento. |
| Atrasado | Conta da data do pagamento, e o dia do vencimento passa a ser esse. |

## Adiantar vários meses de uma vez

Novo campo **"Está pagando quanto tempo"**, de 1 a 12 meses. O total se
multiplica, o vencimento anda tudo junto e sai um pagamento só, com um recibo
só. Quem vencia 10/10 e paga 2 meses passa a vencer 10/12.

Diária não entra nessa conta: para vender mais dias, use um plano com a
quantidade de dias que o aluno quer.

> O valor entra inteiro na receita do mês em que o dinheiro caiu. É assim que
> bate com o extrato do banco.

## O bonequinho

- **Os braços pararam de ficar invertidos.** Todo exercício espelhava o lado
  direito. De frente isso está certo (polichinelo, elevação lateral), mas
  remada, terra e companhia só se leem de perfil — e ali espelhar mandava um
  braço para a frente e o outro para trás. Agora cada exercício diz de que
  ângulo está sendo visto, e de perfil os dois braços vão juntos.
- **Os exercícios ficaram exercícios.** A rosca fechava na horizontal (parecia
  espantalho) e agora a mão sobe até o ombro. A elevação lateral subia com o
  cotovelo dobrado em 90° (trave de gol) e agora sobe esticada. O agachamento
  levantava os braços num V de comemoração e agora segura a barra nos ombros.
  A remada puxa o cotovelo para trás, como remada.
- **O membro de trás ficou mais apagado**, o que dá profundidade e deixa o
  perfil legível.
- **Ele saiu de cima dos botões.** Ficava flutuando no canto superior direito
  do conteúdo, por cima da tela: a linha do chão dele cruzava os botões
  Check-in, Pagamento e Editar. Mudou para a folga da barra lateral, dentro do
  fluxo — não cruza mais nada.
