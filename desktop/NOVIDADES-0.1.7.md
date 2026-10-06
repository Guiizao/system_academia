# DARK FISIC 0.1.7 — o que mudou

Pacote: `DARK-FISIC-Atualizacao-0.1.7.zip` · 77 arquivos · 0,35 MB
Identificação do pacote: **4084F0CCEC635302**

Como aplicar: copie a pasta do zip para o notebook da academia e dê dois cliques
em **ATUALIZAR.bat**. Ele fecha o sistema, troca os arquivos, confere se subiu e,
se algo der errado, volta sozinho para a versão anterior.

---

## 1. Preços e planos: agora dá para mexer em tudo

Era o que faltava para essa área ser 100% sua. O que entrou:

| | Antes | Agora |
|---|---|---|
| Nome e preço | ✔ | ✔ |
| Benefícios, "mais popular" | ✔ | ✔ |
| Criar plano | ✔ | ✔ |
| Desativar | ✔ | ✔ |
| **Reativar** um plano desativado | ✘ sumia para sempre | ✔ botão **Ver desativados** |
| **Duração** de um plano que já existe | ✘ campo travado | ✔ número livre |
| **Ordem** em que aparecem | ✘ | ✔ setas ↑ ↓ em cada cartão |
| **Excluir** de vez | ✘ | ✔ quando nunca foi vendido |

**Duração livre.** Antes a lista era fixa (1, 3, 6, 12 meses). Agora você digita:
2 meses, 4 meses, 18 dias — o que a academia vender. Mudar a duração vale para as
**próximas** renovações; quem já pagou mantém o vencimento contratado.

**Ordem.** As setas mudam na hora e o sistema grava. É a ordem que a recepção vê
na hora de receber, então vale deixar o mais vendido em primeiro.

**Excluir × desativar.** Excluir só funciona em plano que **nunca** foi usado —
criado por engano, nome errado. Se já tem matrícula, o sistema recusa e explica:
desative, que ele sai da lista de venda e o histórico continua inteiro. Essa
recusa é de propósito: apagar um plano com histórico deixaria pagamentos antigos
apontando para o nada.

**Mensalidade ↔ diária.** Dá para converter, mas só quando ninguém está com
matrícula em curso naquele plano. Com aluno dentro, o sistema avisa e não altera
nada — uma diária não gera cobrança no mês seguinte, e o aluno ficaria sem aviso
de vencimento sem ninguém perceber.

**Só o dono** cria, edita, reordena, exclui ou vê os desativados. Recepção e
professor continuam vendo apenas a lista de venda. Isso está coberto por teste.

---

## 2. Correção importante no atualizador (perda de dados)

Achei isso agora, rodando a bateria completa antes de te entregar o pacote.

**O problema.** Quando uma atualização falha, o `ATUALIZAR.bat` desfaz tudo e
devolve o banco guardado. Só que o SQLite grava primeiro num arquivo paralelo
(`-wal`) e só depois passa para o arquivo principal. Logo depois de fechar o
sistema, o banco principal podia estar praticamente vazio, com **tudo** no `-wal`.
O atualizador devolvia só o arquivo principal — e o conteúdo do `-wal` ia embora.

No teste, o banco voltou com **209 KB de dados a menos** e sem nenhuma tabela.
Na academia isso significaria: uma atualização falha, o sistema volta, e os
alunos cadastrados depois do último ponto de gravação somem.

**A correção.** O backup e a devolução agora tratam o trio `.db` + `-wal` + `-shm`
como uma coisa só. Acrescentei um teste que grava um registro com o sistema no ar
(justamente para ele ficar no `-wal`), força a falha e exige que o registro
continue lá depois de desfazer. Com o código antigo esse teste falha; com o novo,
passa.

---

## 3. Bateria rodada nesta versão

| | |
|---|---|
| Testes da API | **256** (18 novos só de planos) |
| Testes do front | **90** (4 novos de ordem) |
| Testes do app de PC | **6** |
| Verificação de tipos | limpa (API e front) |
| Encaixe do painel | ok em 4 tamanhos de janela |
| Cenários do atualizador | **6 de 6**, incluindo os dois de desfazer |

---

## 4. O que continua na fila

1. **Travar tentativa repetida de login** — hoje dá para ficar chutando senha.
2. **Backup fora do notebook** — se o notebook queimar, o banco vai junto.
3. **Conferir o cookie de sessão em HTTPS** — muda de comportamento quando o
   acesso passa pelo túnel.

Esses três são o que eu quero entregar **antes** de o endereço ficar público.
O passo a passo do Cloudflare está em `GUIA-ONLINE-CLOUDFLARE.md`.

4. **Treinos e Agenda** — você ainda não testou essas duas telas.
5. **WhatsApp automático** — parado até chegar o chip da academia.
