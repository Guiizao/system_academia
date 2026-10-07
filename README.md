# DARK FISIC: sistema de gestão

Sistema da academia. O **notebook da academia é o host**: o app de PC roda o servidor
e o banco dentro de si. Recepção, celulares e outros PCs acessam pela rede local.

```
desktop/   app de PC (Electron): servidor embutido, painel Iniciar/Parar, backup, QR do celular
api/       servidor (Fastify + SQLite): regras de negócio, com testes
web/       interface (React): PC, tablet e celular; instalável no celular (PWA)
docs/      guias (PDF e Markdown), capturas, spec e planos
```

## Instalar na academia

Instalador pronto: **`desktop/instalador/DARK-FISIC-Instalador-0.1.1.exe`** (~120 MB).

- **[docs/DARK-FISIC-Guia-de-Instalacao.pdf](docs/DARK-FISIC-Guia-de-Instalacao.pdf)**: passo a passo ilustrado, para imprimir
- **[docs/DARK-FISIC-Funcionalidades.pdf](docs/DARK-FISIC-Funcionalidades.pdf)**: tudo o que o sistema faz hoje
- **[docs/INSTALACAO.md](docs/INSTALACAO.md)**: o mesmo passo a passo, em texto
- **[docs/GUIA-DA-EQUIPE.md](docs/GUIA-DA-EQUIPE.md)**: uso diário, para deixar na recepção

Os PDFs saem de `docs/_pdf/*.html`: `cd desktop && ./node_modules/electron/dist/electron.exe scripts/gerar-pdf.cjs ../docs/_pdf/funcionalidades.html ../docs/DARK-FISIC-Funcionalidades.pdf`.
As capturas saem de `desktop/scripts/roteiro-docs.mjs` + `capturar.cjs`, com a API de demonstração em :3000.

Para gerar o instalador de novo: `cd desktop && npm run build`. O build termina com `scripts/testar-pacote.mjs`:
copia o app para **fora** do projeto, liga e só aprova se o servidor e o banco subirem. Rodar o pacote de dentro da
pasta do projeto engana: o Node acha o `desktop/node_modules` subindo pastas (foi assim que a 0.1.0 quebrada passou).

Logo: `desktop/build/logo.svg` é a fonte única. `cd desktop && npm run icones` gera o `.ico`, os ícones da bandeja
e os do celular a partir dela.

## Uso na academia

1. Abrir o app **DARK FISIC** no notebook. O servidor sobe sozinho.
2. Primeira vez: criar a conta do administrador no painel (`admin@darkfisic.local` + senha escolhida na hora),
   ou "Testar com dados de demonstração". Os donos e a equipe se cadastram em Configurações → Equipe.
3. **Abrir o sistema** no painel, ou em qualquer PC da rede pelo endereço mostrado.
4. Celular: no mesmo Wi-Fi, apontar a câmera para o QR do painel e tocar em
   **Adicionar à tela inicial**.
5. Marcar **Iniciar junto com o Windows** para o sistema subir sozinho ao ligar o PC.

Fechar a janela **não** derruba o sistema: ele segue na bandeja do Windows.
Para tirar do ar: bandeja → **Encerrar**.

**Dados:** `%LOCALAPPDATA%\DarkFisic\` (`dados\`, `backups\`, `logs\`). Fora do OneDrive
de propósito — sincronizar um SQLite aberto corrompe o banco.

## Desenvolvimento

Pré-requisito: Node 20+.

```bash
cd api && npm install && npm test
cd api && npm run db:seed                  # banco de demonstração (recusa se já houver dados)
cd api && npm run dev                      # API em :3000
cd web && npm install && npm run dev       # interface em :5173 (fala com a API em :3000)
```

App de PC:

```bash
cd desktop && npm install
cd desktop && npm run preparar             # compila api + web e monta desktop/app
cd desktop && npm run iniciar              # abre o app
```

`desktop/node_modules` tem `better-sqlite3` recompilado para o Electron (ABI diferente do
Node do sistema). Por isso o app desktop leva uma cópia própria do servidor em `desktop/app`
e o `api/node_modules` continua servindo os testes. Se o Electron for atualizado:
`cd desktop && npm run rebuild-nativos`.

## Usuários de demonstração

Senha de todos: `darkfisic123`. **Só para teste**, nunca numa instalação exposta pelo túnel.

| E-mail | Papel | CREF |
|---|---|---|
| joao@darkfisic.com | dono | nenhum (de propósito: não libera fichas) |
| pedro@darkfisic.com | professor | 123456-G/SP |
| ana@darkfisic.com | professor | 234567-G/SP |
| bruna@darkfisic.com | recepção | nenhum |

## Regras que não devem ser quebradas

- **Status do aluno é derivado** da matrícula, nunca armazenado (`api/src/dominio/status.ts`).
- **Dinheiro em centavos inteiros.** Nunca float.
- **Check-in grava `data_local`** no fuso de São Paulo. Consultas de "hoje"/"mês" usam esse
  campo, nunca o recorte do horário UTC, que joga check-ins depois das 21h para o dia seguinte.
- **A ficha é liberada por quem está logado.** Não existe "liberar em nome de": o servidor grava o id de quem
  clicou e o CREF que essa pessoa tinha na hora, ou `null` se não tinha. **Liberar não tem trava** — nem de CREF,
  nem de papel (decisão do dono, 25/09/2026): qualquer pessoa logada libera, a tela avisa e o registro fica.
  Nunca gravar string vazia no lugar do `null`, que viraria selo falso de conformidade. Montar ficha continua
  restrito a dono e professor.
- **Permissões são conferidas no servidor.** Esconder botão na tela não é permissão.
- **IA desativada** até haver veredito (`IA_HABILITADA=false`). A rota existe e responde 503.
- **Cobrança nasce sozinha** quando a matrícula entra na janela de aviso (`gerarCobrancasDevidas`), roda a cada leitura
  e é idempotente pela unicidade (matrícula, competência). Renovar quita a do período anterior; desativar o aluno cancela.
- **Biblioteca de exercícios é dado de referência**: `garantirCatalogo` preenche em toda instalação (e ao subir o servidor).
- **Cópia de antes do reset** (`antes-do-reset-*.db`) fica fora da retenção automática.

## Pendências conhecidas

- Backup para **fora do notebook, criptografado** (spec §9.4, camada 2). Hoje o backup é local.
- Túnel Cloudflare (acesso fora da academia): não configurado.
- Instalador sem assinatura digital: o Windows mostra o aviso azul.
- WhatsApp e confirmação automática de Pix: desenhados, desligados.
