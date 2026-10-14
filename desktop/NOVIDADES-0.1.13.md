# DARK FISIC 0.1.13 — revisão geral

Versão de revisão: nada novo para aprender, várias coisas mais firmes.

## Tela (revisão do Claude)

- **Cores de aviso legíveis em todos os temas.** O amarelo, o verde e o
  vermelho dos selos ("Vencendo", "Ativo", "Vencido") e das faixas de aviso
  estavam fracos demais em alguns temas — o pior era o amarelo do tema Claro.
  Os tons foram ajustados de leve e agora passam no mínimo de legibilidade em
  todos os cinco temas.
- **Produtos no celular:** o botão Cancelar da venda não sai mais da linha.
- **Plano desativado:** se o plano do aluno foi desativado, a janela de
  pagamento agora avisa para escolher outro. Antes o pagamento entrava avulso
  e o vencimento não andava, sem nenhum aviso.

Conferido em 7 telas × 7 tamanhos (celular em pé e deitado, tablet, notebook e
monitor), com os 5 temas e com os 10 efeitos ligados: nada passa da borda,
nenhuma caixa encosta no canto, nenhum texto ou botão vaza, bordas
padronizadas. O bonequinho não encosta em botão nenhum.

## Lógica (revisão do Codex)

- Professor não consegue mais registrar pagamento pelo cadastro do aluno.
- Cadastrar aluno já pagando agora é uma operação só: não fica pela metade.
- Plano e aula **desativados** não aceitam mais renovação nem inscrição.
- Datas que não existem (31/02) e horários impossíveis são recusados com
  explicação.
- Sair do sistema encerra a sessão de verdade.
- Fiado antigo não some mais da lista depois de 100 vendas.
- **Backup:** duas cópias no mesmo segundo não se sobrescrevem; se o backup
  automático falhar, ele tenta de novo no mesmo dia; "Começar do zero" só
  apaga depois de guardar a cópia.
- **Internet:** o botão não abre dois túneis, e o túnel fecha ao sair.
- **Atualizador:** se a troca de arquivos falhar no meio, a versão anterior
  volta inteira.
