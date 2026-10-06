# Colocar o DARK FISIC online — guia do túnel Cloudflare

Hoje o sistema só responde dentro da Wi-Fi da academia. Com o túnel, o mesmo
notebook passa a atender de qualquer lugar, por um endereço `https://`, **sem
abrir porta no roteador e sem IP fixo**.

Como funciona: o programa `cloudflared` roda no notebook e faz uma ligação de
dentro para fora, até a Cloudflare. Quem acessa o endereço chega na Cloudflare,
e ela entrega pelo túnel que já está aberto. O roteador continua fechado —
ninguém da internet alcança o notebook direto.

---

## 1. O que precisa antes de começar

| Item | Custo | Observação |
|---|---|---|
| Conta Cloudflare | Grátis | Só e-mail e senha |
| Programa `cloudflared` | Grátis | Instala no notebook da academia |
| Domínio próprio | ~R$ 40/ano | Opcional, mas é o que dá endereço fixo e bonito |
| Cloudflare Access (login na porta) | Grátis até 50 pessoas | Recomendado |

Tempo: **20 a 30 minutos**, tudo no notebook da academia.

> **Antes de abrir para a internet** — eu ainda preciso entregar duas coisas no
> sistema, e elas vão na próxima versão:
> 1. **Travar tentativa de login repetida** (hoje alguém pode ficar chutando senha à vontade).
> 2. **Backup fora do notebook** (se o notebook queimar, hoje o banco vai com ele).
>
> Também preciso conferir no código a marcação do cookie de sessão (`secure` /
> `sameSite`), que muda de comportamento quando o acesso passa a ser `https`.
> Dá para fazer o **teste rápido** do passo 2 agora mesmo sem risco, porque o
> endereço é temporário e você fecha na hora. O endereço definitivo eu faria
> só depois desses três itens.

---

## 2. Teste rápido (5 minutos, sem domínio, sem conta)

Serve para você ver funcionando antes de decidir qualquer coisa.

1. Abra o PowerShell no notebook da academia.
2. Instale o programa:
   ```
   winget install --id Cloudflare.cloudflared
   ```
   Se o `winget` não existir nessa máquina, baixe o arquivo
   `cloudflared-windows-amd64.exe` da página de releases oficial
   (`github.com/cloudflare/cloudflared/releases/latest`), renomeie para
   `cloudflared.exe` e guarde em `C:\cloudflared\`.
3. Com o DARK FISIC **aberto**, rode:
   ```
   cloudflared tunnel --url http://localhost:3000
   ```
4. Ele vai imprimir um endereço tipo
   `https://alguma-coisa-aleatoria.trycloudflare.com`.
   Abra esse endereço no celular, **usando dados móveis** (não a Wi-Fi da
   academia) — é a prova de que veio de fora.
5. Para encerrar: `Ctrl + C` na janela. O endereço morre junto.

Esse endereço gratuito **troca a cada vez** que você liga, e não tem o login da
Cloudflare na frente. É só teste — não divulgue para aluno.

---

## 3. Endereço definitivo (o que vale a pena de verdade)

### 3.1 Criar a conta
Em `dash.cloudflare.com`, crie a conta com o e-mail da academia e **ative a
verificação em dois passos** (a conta passa a ser a chave da porta da frente).

### 3.2 O domínio

Duas opções:

- **`.com.br`** — registra no `registro.br` (R$ 40/ano, pede CPF ou CNPJ).
  Depois, na Cloudflare, "Add a site", e o registro.br passa a apontar para os
  dois servidores DNS que a Cloudflare mostrar. Leva de minutos a algumas horas
  para valer.
- **`.com`** — dá para comprar dentro da própria Cloudflare (~US$ 11/ano), e já
  vem configurado. Menos passos, preço em dólar.

Sugestão de endereço: `painel.darkfisic.com.br` (ou `app.`).

### 3.3 Criar o túnel pelo painel (caminho mais simples)

1. No painel Cloudflare: **Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Tipo: **Cloudflared**. Nome: `darkfisic-notebook`.
3. A tela mostra um comando pronto para Windows, com um código comprido
   (o *token* do túnel). **Copie esse comando** e rode no PowerShell do
   notebook **como administrador**:
   ```
   cloudflared.exe service install <TOKEN-QUE-O-PAINEL-MOSTROU>
   ```
   Isso instala o túnel **como serviço do Windows**: ele sobe sozinho quando o
   notebook liga, antes de alguém fazer login.
4. Volte ao painel, aba **Public Hostname → Add a public hostname**:
   - **Subdomain:** `painel`
   - **Domain:** `darkfisic.com.br`
   - **Type:** `HTTP`
   - **URL:** `localhost:3000`
5. Salve. Em menos de um minuto, `https://painel.darkfisic.com.br` já abre o
   sistema — com certificado HTTPS automático.

> O token é a chave do túnel. Não mande por WhatsApp e não deixe anotado em
> papel no balcão. Se vazar, no painel você clica em **Refresh token** e o
> antigo deixa de valer.

### 3.4 Porta diferente
Se o sistema estiver rodando em outra porta (`DF_PORTA`), troque o `3000` do
passo 4 pelo número certo. Para conferir: abra `http://localhost:3000/status`
no navegador do notebook — se responder um texto com `"ok": true`, é essa.

---

## 4. Uma porta antes da porta (Cloudflare Access)

Isto é o que eu mais recomendo. Sem Access, qualquer pessoa da internet chega
na **tela de login** do sistema e pode ficar tentando. Com Access, ela não
chega nem lá.

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Nome: `DARK FISIC`. Domínio: `painel.darkfisic.com.br`.
3. Em **Policies**, crie uma política:
   - Nome: `Equipe`
   - Action: **Allow**
   - Include: **Emails** → liste os e-mails de quem pode entrar
     (o seu, o do João, o da recepção).
4. Método de login: **One-time PIN** (a Cloudflare manda um código no e-mail).
   Não precisa criar senha nova nem instalar nada.

Resultado: quem abre o endereço recebe primeiro a tela da Cloudflare pedindo o
e-mail; só quem está na lista chega no login do DARK FISIC. São duas portas.

**Aluno acessando:** se um dia os alunos forem usar, aí o Access precisa ficar
só na parte da equipe (caminhos `/api/admin`, por exemplo) — me avise antes,
porque isso mexe nas rotas do sistema e eu preciso ajustar o código.

---

## 5. O notebook precisa ficar de pé

O túnel só funciona enquanto o notebook está ligado e com internet.

- **Painel de Controle → Opções de Energia → Alterar configurações do plano:**
  com energia na tomada, "Desligar vídeo" pode ser 10 min, mas
  **"Suspender atividade do computador" tem que ser `Nunca`**.
- **"Escolher a função do fechamento da tampa"** (ligado na tomada):
  **`Não fazer nada`** — senão fechar a tampa derruba o sistema.
- Deixe o notebook **sempre na tomada** e, de preferência, com cabo de rede.
  Wi-Fi caindo = sistema fora do ar.
- O DARK FISIC já pode subir junto com o Windows (está no painel do sistema,
  opção "Abrir junto com o Windows"). Confirme que está marcado.
- **Reinício depois de queda de luz:** vale olhar na BIOS a opção
  `Restore on AC Power Loss` → `Power On`, se esse POSITIVO tiver. Sem isso,
  depois de um apagão alguém precisa apertar o botão.

---

## 6. Conferir se está tudo certo

| Teste | Como | Esperado |
|---|---|---|
| Serviço rodando | PowerShell: `Get-Service cloudflared` | `Status: Running` |
| Túnel conectado | Painel → Tunnels | bolinha verde, `HEALTHY` |
| Acesso de fora | Celular **nos dados móveis**, abrir o endereço | tela da Cloudflare, depois o login |
| Sobrevive ao reinício | Reiniciar o notebook e **não** fazer login no Windows | endereço continua abrindo |

O último teste é o mais importante: é ele que prova que o serviço sobe sozinho.

---

## 7. Como desligar, se quiser voltar atrás

- **Fechar o acesso na hora, de qualquer lugar:** painel → Tunnels → o túnel →
  **Delete**. Cai imediatamente; o sistema volta a funcionar só na Wi-Fi.
- **Tirar do notebook:** PowerShell como administrador →
  ```
  cloudflared.exe service uninstall
  ```
- Nada disso mexe no banco de dados nem nos alunos. É só o caminho de entrada.

---

## 8. Problemas comuns

**"Abre em casa mas não abre no celular"** — você estava na Wi-Fi da academia.
Desligue o Wi-Fi do celular e teste nos dados.

**`Error 1033` / `Tunnel not found`** — o serviço parou. `Get-Service cloudflared`,
e se estiver parado: `Start-Service cloudflared`.

**`502 Bad Gateway`** — o túnel está de pé, mas o DARK FISIC não.
Abra o programa no notebook e veja se o painel mostra "servidor ligado".

**"Site não encontrado" logo depois de comprar o domínio** — DNS ainda
propagando. Pode levar algumas horas no `.com.br`.

**O endereço abre, mas o login não aceita a senha certa** — é o caso do cookie
que eu mencionei no começo. Me chame: é ajuste no código, não na Cloudflare.

---

## 9. O que eu faço e o que você faz

**Você, no notebook da academia (20–30 min):** criar a conta Cloudflare,
registrar o domínio, rodar o comando do passo 3.3, cadastrar o endereço
público e a política de Access.

**Eu, no código, antes de divulgar o endereço:** travar tentativa repetida de
login, backup automático fora do notebook e a conferência do cookie de sessão
em HTTPS.

Se preferir, faça só o **teste rápido do passo 2** e me mande o que apareceu —
dali eu já consigo confirmar se o resto vai no caminho certo.
