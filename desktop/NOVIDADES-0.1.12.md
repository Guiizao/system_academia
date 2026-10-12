# DARK FISIC 0.1.12

## Excluir pagamento lançado por engano

No **Financeiro → Pagamentos recentes**, cada pagamento tem um botão **Excluir**,
que só o **dono** vê. Para excluir, o sistema pede **a senha de quem está logado**
(com limite de tentativas).

Ao excluir, o vencimento do aluno **volta ao que era antes** daquele pagamento:
pagou em dobro e foi de 13/11 para 13/12? Excluindo o repetido, volta para 13/11.
A cobrança que ele tinha quitado volta a ficar em aberto. Vale também para os
pagamentos lançados antes desta versão.

> Se o aluno pagou de novo **depois** do pagamento que você quer excluir, o
> sistema recusa e pede para excluir primeiro o mais recente — senão os
> vencimentos se embaralham. No lançamento em dobro isso não atrapalha: o
> repetido é sempre o último.

## Produtos: a lojinha da academia

Aba nova no menu, logo depois do Financeiro, para dono e recepção.

- **Vitrine** com foto, nome, preço e estoque (selo amarelo quando está baixo,
  vermelho quando esgotou), busca por nome ou categoria, e três números no
  topo: produtos, estoque baixo e **fiado em aberto**.
- **Cadastro** (só o dono): nome, preço, estoque, categoria, descrição e até
  **3 fotos**. As fotos são reduzidas no próprio computador antes de salvar.
- **Vender**: quantidade e para quem. Digitando o nome aparece a lista de
  alunos; se não for aluno, fica como cliente avulso. **Pago agora** (com a
  forma) ou **Fiado** — fiado exige o nome de quem levou. O estoque baixa na hora.
- **Vendas** em duas abas, **Fiado** e **Pagas**. No fiado, **Receber…** com a
  forma de pagamento. **Cancelar** só o dono, com senha, e o produto volta ao estoque.

> A venda de produto **não entra na receita de mensalidade** do Financeiro: tem o
> próprio total na tela de Produtos.
