# AGENTS.md — DARK FISIC (academia)

Instruções para Codex e Claude (o `CLAUDE.md` só importa este arquivo). Curto de propósito: o detalhe fica nas skills de `.agents/skills/`, lidas só quando a tarefa pede.

## Como trabalhar

- Profundidade proporcional ao pedido: pergunta simples tem resposta direta, sem plano nem relatório.
- Leia o código que a mudança toca antes de mudar e reaproveite o que existe. A solução mais simples que é correta; menos linhas só se não perder validação, tratamento de erro, segurança ou acessibilidade.
- Dependência nova só com motivo concreto, escrito na entrega.
- Entregue com evidência: o comando rodado e o resultado. Não diga "testado" sem ter rodado.
- Textos para o dono do projeto em português do Brasil simples: ele não é programador.

## Skills (ler o SKILL.md quando a tarefa pedir)

| Quando | Skill em `.agents/skills/` |
|---|---|
| Criar ou alterar tela, componente ou tema | `verificar-interface` e `direcao-de-design` |
| Rota, regra de negócio, permissão, banco, integração | `revisar-backend` |
| Página pública, ou expor o sistema na internet | `seo-tecnico` |
| Passar ou receber tarefa entre Claude e Codex | `passagem-de-tarefa` |

## Projeto

- `api/`: Fastify + SQLite (Drizzle); regra de negócio em `api/src/dominio` e `api/src/servicos`, rotas em `api/src/rotas`.
- `web/`: React + Vite (PWA), tokens de tema em `web/src/estilos/tokens.css`.
- `desktop/`: Electron que embute a API; leva cópia própria do servidor em `desktop/app` (ver README › Desenvolvimento).
- Sistema interno: tela com `noindex`; o acesso pela internet (túnel Cloudflare) só expõe a tela de entrar.

## Regras que não se quebram

- As de README.md › "Regras que não devem ser quebradas": ler antes de mexer em matrícula, dinheiro, check-in, ficha, permissão, IA ou cobrança.
- Dado de aluno nunca sai do notebook: nada de serviço externo recebendo dado pessoal; banco e backups fora do git.

## Testes

- API: `cd api && npm test`. Web (regra pura): `cd web && npm test`. Desktop: `cd desktop && npm test`.
- Telas nos 6 tamanhos de referência:
  1. banco de demonstração fora do projeto: `cd api && DB_PATH=<pasta-temp>/demo.db npm run db:seed`
  2. `cd web && npm run build`, depois a API servindo o build: `cd api && DB_PATH=<pasta-temp>/demo.db WEB_DIST=../web/dist SESSION_SECRET=<qualquer> npx tsx src/index.ts`
  3. `node .agents/skills/verificar-interface/scripts/auditar-telas.mjs --roteiro .agentes/roteiro-telas.json --saida <pasta-temp>/telas`
  (No PowerShell, variável de ambiente é `$env:DB_PATH="..."` antes do comando.)
