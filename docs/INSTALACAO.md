# Instalação na academia: guia técnico

Para quem instala e cuida do sistema. A versão ilustrada, para imprimir, é o
**`DARK-FISIC-Guia-de-Instalacao.pdf`** nesta pasta. O guia da equipe é o `GUIA-DA-EQUIPE.md`.

## O que levar

| Arquivo | Onde está | Tamanho |
|---|---|---|
| `DARK-FISIC-Instalador-0.1.1.exe` | `desktop/instalador/` | ~120 MB |

Leve num pendrive. **Não precisa de internet** para instalar nem para usar na rede da academia.
Tenha em mãos: a chave Pix (e o nome do recebedor como aparece no banco), nome e e-mail de
cada pessoa da equipe e o CREF de cada professor que tiver.

---

## 1. Instalar no notebook

1. Copie o instalador para o notebook e dê **dois cliques**.
2. **Aviso azul do Windows** ("O Windows protegeu o computador"): clique em
   **Mais informações** e depois em **Executar assim mesmo**. Aparece porque o programa
   não tem assinatura digital paga; não é vírus.
3. Conclua. A pasta padrão serve. **Não pede senha de administrador**: a instalação é
   para o usuário atual.
4. Se o Windows perguntar sobre o **firewall**, marque **Redes privadas** e permita.
   Sem isso os celulares não abrem o sistema.

## 2. Criar a conta do administrador

Na primeira abertura o painel mostra o cartão **Conta do administrador**, com o e-mail
**`admin@darkfisic.local`** já preenchido.

- Escolha uma **senha de no mínimo 10 caracteres** e clique em **Criar conta do administrador**.
- Depois, **Abrir o sistema** e entre com esse e-mail e essa senha.

**Não existe senha padrão, de propósito.** Uma senha de fábrica seria a mesma em toda cópia
do instalador; quando o sistema for para a internet, isso vira porta aberta. Anote a senha
num lugar seguro.

A instalação já vem com os 4 planos (Básico, Plus, Trimestral, Anual) e a biblioteca de
30 exercícios com contraindicações.

## 3. Cadastrar os donos e a equipe

No sistema: **Configurações → Equipe → Cadastrar pessoa**.

| Papel | Vê | Não vê |
|---|---|---|
| **Dono** | tudo, inclusive equipe, preços e Pix | nada |
| **Recepção** | alunos, check-in, pagamentos, agenda | receita do mês, inadimplência, preços |
| **Professor** | alunos, avaliações, fichas, agenda | qualquer coisa de dinheiro |

- **CREF é aviso, não trava.** Quem está sem CREF cadastrado libera ficha do mesmo jeito, mas vê um aviso
  antes e a ficha fica marcada como **liberada sem CREF**, com o nome de quem liberou. Quem tem CREF
  cadastrado assina a ficha com ele. A Lei 9.696/1998 reserva a prescrição de exercício a profissional de
  Educação Física; a decisão de liberar assim mesmo é de quem responde pela academia.
- **Qualquer pessoa da equipe libera ficha**, inclusive a recepção: nada trava, o sistema só avisa e registra.
  Montar a ficha continua sendo de dono e professor.
- Cadastre **pelo menos dois donos**: se um esquecer a senha, o outro redefine.
- Clicando numa pessoa dá para **redefinir a senha** ou **bloquear o acesso** (desconecta na hora).

## 4. Dados da academia, Pix e preços

- **Configurações → Academia → Editar dados e Pix**: tipo e chave Pix, nome do recebedor
  **igual ao do banco** e cidade. O sistema monta um código de teste antes de salvar e recusa
  o que o banco não aceitaria.
- Prazos: aviso de vencimento (padrão 5 dias) e aluno sumido (padrão 10 dias).
- **Financeiro → Editar** em cada plano: preço e benefícios. Preço novo vale para as
  próximas renovações; quem já pagou mantém o valor.

## 5. Deixar sempre ligado

- No painel, marque **Iniciar junto com o Windows**.
- Fechar a janela **não** desliga: o sistema fica no ícone ao lado do relógio. Para desligar:
  botão direito no ícone → **Encerrar (tira o sistema do ar)**.
- Windows: **Energia e suspensão → Nunca** quando conectado. Se usar a tampa fechada:
  **Escolher a função do fechamento da tampa → Nada a fazer**.
- **Reserve o IP do notebook no roteador** (DHCP estático). Sem isso o endereço pode mudar
  quando o roteador reinicia; aí é só olhar o novo no painel.

## 6. Celulares na rede

Com o celular **no mesmo Wi-Fi**, aponte a câmera para o QR code do painel (ou digite o
endereço `http://192.168.x.x:3000` mostrado embaixo dele).

- **iPhone (Safari):** compartilhar → **Adicionar à Tela de Início**.
- **Android (Chrome):** menu ⋮ → **Adicionar à tela inicial**.

> **Limitação do Android:** o app "instalável de verdade" só existe em HTTPS. Na rede local o
> endereço é HTTP, então o Chrome cria um atalho comum. Funciona igual. Resolve-se com o túnel.

Tema claro ou escuro: cada aparelho escolhe em **Configurações → Aparência**.

## 7. Sem Wi-Fi

O sistema funciona **só no notebook**: abra o DARK FISIC e clique em **Abrir o sistema**.
O painel avisa "Funcionando só neste computador". Quando o notebook entrar numa rede,
o endereço e o QR code aparecem sozinhos em até 15 segundos. Internet não é necessária,
só o roteador.

## 8. Testar e começar do zero

- **Testar com dados de demonstração** (no cartão da conta do administrador, com o sistema
  vazio): 40 alunos, pagamentos, check-ins, aulas e 4 logins com a senha `darkfisic123`.
- **Começar do zero** (cartão no painel): **Apagar dados…** → digite **APAGAR TUDO** →
  **Apagar e começar do zero**. Apaga alunos, pagamentos, equipe, tudo, e volta à
  primeira abertura.
- Antes de apagar, o sistema salva `backups\antes-do-reset-<data>.db`. Esse arquivo
  **nunca é apagado pela limpeza automática**; se não precisar mais dele, apague pela pasta.
- O botão só existe no painel do notebook. Ninguém consegue apagar pelo celular.

---

## Onde ficam os dados

```
%LOCALAPPDATA%\DarkFisic\
  dados\      academia.db  <- o sistema inteiro está aqui
  backups\    cópias automáticas e a cópia de antes do reset
  logs\       registro de eventos
```

Fora do OneDrive de propósito: sincronizar um banco SQLite aberto corrompe o arquivo.
**Desinstalar não apaga esses dados.**

## Backup

Automático todo dia depois das 3h. Guarda o mais recente de cada um dos últimos 7 dias,
4 semanas e 12 meses. **Mas fica no próprio notebook.** Até existir o backup externo:

> **Uma vez por semana**, painel → **Backup** → **Abrir pasta**, e copie o arquivo mais
> recente para um pendrive ou para o Google Drive.

## Atualizar

Rode o instalador novo por cima, **sem desinstalar antes**. Os dados ficam, e os restos da versão
anterior são limpos pelo próprio instalador. Se a atualização mudar a estrutura do banco, o sistema
faz uma cópia antes, sozinho. A primeira abertura depois de instalar demora um pouco mais (o Windows
examina os arquivos novos).

> **Da 0.1.0 para a 0.1.1:** a 0.1.0 não ligava o servidor fora do computador onde foi montada
> ("Cannot find package 'dotenv'"). Instale a 0.1.1 por cima e confira no painel: "Servidor, versão 0.1.1".

## Quando algo der errado

O painel tem o **Registro** no rodapé, com os últimos eventos. Peça um print.

| Sintoma | O que fazer |
|---|---|
| Celular não abre | Mesmo Wi-Fi do notebook (não 4G)? O IP mudou? Confira no painel e escaneie de novo. |
| Painel diz "no ar", mas nenhum celular abre | Firewall: Segurança do Windows → Firewall → Permitir um aplicativo → DARK FISIC em **Privada**. |
| "A porta 3000 já está em uso" | Outro programa ocupou a porta. Reinicie o notebook. |
| Pede login toda hora | A sessão dura 12 horas. É esperado. |
| Esqueci a senha do administrador | Outro dono redefine em Configurações → Equipe. Sem outro dono, só começando do zero. |
| Tudo parado | Procure o ícone ao lado do relógio. Se não estiver, abra pelo atalho da área de trabalho. |

## O que ainda não existe

- **Backup automático fora do notebook** (por isso a cópia semanal manual).
- **Acesso de fora da academia**: só funciona no Wi-Fi local até montarmos o túnel Cloudflare.
- **WhatsApp**: avisos e cobrança automática estão desenhados e desligados.
- **Ficha de treino por IA**: desligada de propósito, até termos um veredito.
- **Confirmação automática de Pix**: o sistema gera o QR code e o copia e cola, mas quem
  confirma é a recepção, conferindo o **extrato do banco**.
