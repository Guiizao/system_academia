# DARK FISIC 0.1.11

## Botão para colocar o sistema na internet

No painel do servidor, no cartão **Acesso pelo celular e outros PCs**, apareceu
a parte **Acesso de fora da academia**. Um clique em **Colocar na internet** e o
painel:

1. liga o `cloudflared`;
2. lê o endereço `https://...trycloudflare.com` que ele devolve;
3. mostra o endereço escrito, o **QR code** para apontar a câmera, e um botão
   de copiar.

Para desligar, **Tirar da internet**.

> **Precisa do cloudflared instalado.** Se não estiver, o painel diz isso e
> mostra o comando: `winget install --id Cloudflare.cloudflared` no PowerShell
> como administrador. Enquanto não instalar, o botão avisa em vez de falhar
> sem explicação.

> **Enquanto está ligado, qualquer pessoa com o endereço chega na tela de
> entrar.** O que segura a porta é o e-mail e a senha. O endereço é sorteado e
> muda toda vez que você liga. Desligue quando não precisar — o aviso fica na
> tela junto com o link, de propósito.

## Olho para esconder os valores

Um olhinho ao lado do dinheiro em **Início**, **Financeiro**, **Relatório do
mês** e nos **pagamentos do aluno**. Clicou, todo valor vira `R$ ••••`.

É **uma escolha só** para o sistema inteiro: esconder no Início esconde no
Financeiro também — não adiantaria tapar um número e deixar o outro aberto. A
escolha fica guardada neste aparelho, como o tema.

Não é segurança: quem tem a senha vê tudo clicando no olho de novo. Serve
contra o olhar de quem está encostado no balcão, que é o problema real.

## O bonequinho

**A animação destravou.** Não era falta de quadros por segundo — medi: 180 por
segundo, nenhum quadro perdido. O problema era a conta: cada trecho entre dois
quadros era suavizado sozinho, então a velocidade caía a **zero cinco vezes por
repetição**. Agora a interpolação olha os quadros vizinhos, passa por eles sem
frear e só desacelera onde o movimento realmente vira — no fundo do
agachamento, no topo da rosca.

**A câmera gira.** Entre um exercício e outro, enquanto ele pega o aparelho, a
câmera dá a volta. Cada exercício agora é mostrado do ângulo em que ele se lê:

| De frente | De perfil |
|---|---|
| Agachamento, rosca, desenvolvimento, elevação lateral, panturrilha, polichinelo, corda | Remada curvada, levantamento terra, tríceps francês, avanço, corrida |

**E com isso os exercícios errados ficaram certos.** A remada voltou a ser
**curvada** (tinha virado remada alta porque de frente a curvada parecia um
boneco tombado). O terra voltou a ter dobradiça de quadril, em vez de parecer
um agachamento de braço esticado. O tríceps mostra o antebraço caindo **atrás**
da cabeça, que de frente não dava para ver. O avanço mostra uma perna à frente
e a outra atrás, em vez de duas pernas abrindo para os lados.

De perfil a largura dos ombros quase some, como tem de ser: com a largura cheia
o boneco parecia de três quartos, não de lado.

## Tela de alunos

A coluna da lista ficou mais larga para os cinco filtros caberem numa linha só.
