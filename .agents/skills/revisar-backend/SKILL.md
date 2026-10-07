---
name: revisar-backend
description: Checklist de backend para implementar ou revisar rotas, regras de negócio, autenticação, permissões, banco de dados e integrações - validação de entrada, autorização no servidor, segredos, erros e logs, consultas eficientes, vulnerabilidades comuns e testes dos fluxos críticos. Use ao criar ou alterar código de servidor e na revisão cruzada entre Claude e Codex.
---

# Revisar backend

Princípio: a solução mais simples que é correta. Menos linhas só vale se não perder validação, tratamento de erro, segurança ou clareza. Dependência nova só com motivo concreto, escrito na entrega.

## Antes de escrever

1. Leia o fluxo inteiro que a mudança toca (rota → serviço/domínio → banco) e os testes existentes. Reaproveite o que já existe.
2. Regra de negócio fica no serviço ou no domínio, não na rota nem na tela.
3. Bug: ache a causa e corrija no ponto por onde todos os chamadores passam, não só no caminho do relato.

## Checklist (marque o que se aplica)

- **Entrada**: todo dado de fora (corpo, query, parâmetros, cabeçalho, arquivo, sincronização de aparelho, webhook) é validado no servidor com esquema ou checagem explícita: tipo, tamanho, faixa, campos permitidos.
- **Autenticação**: cookie de sessão `HttpOnly` e `SameSite` (e `Secure` com HTTPS); senha com argon2 ou PBKDF2 com sal; limite de tentativas; sessão encerrada ao trocar senha ou desativar a pessoa.
- **Autorização**: conferida em cada rota no servidor, por papel e por dono do recurso. Esconder botão não é permissão. Teste explícito do caso "sem permissão".
- **Segredos**: nunca no código, no log, na resposta, no front nem em serviço externo sem necessidade. `.env` fora do git. Mensagem de erro sem detalhe interno.
- **Erros e logs**: erro esperado devolve o status certo e uma mensagem útil; erro inesperado vai para o log com contexto (rota, id), sem senha nem dado pessoal. Nunca engolir exceção em silêncio.
- **Banco**: consulta parametrizada (nunca concatenar SQL); índice para filtro frequente; sem consulta dentro de laço (N+1); transação quando várias escritas precisam andar juntas; dinheiro em inteiro (centavos).
- **Vulnerabilidades comuns (OWASP)**: injeção, XSS (escapar saída, cuidado com `innerHTML`), CSRF em rota com cookie, caminho de arquivo vindo do usuário, SSRF em URL vinda de fora, redirecionamento aberto, upload sem limite, CORS aberto sem motivo, comparação de segredo em tempo constante, dependência com falha conhecida (`npm audit`).
- **Desempenho**: meça antes de otimizar (tempo da rota, número de consultas). Pagine o que cresce. Cache só com regra clara de invalidação.
- **Testes**: regra nova ou bug corrigido ganha teste. Fluxo crítico (login, permissão, cobrança, sincronização, dado que não pode se perder) tem caso feliz, caso recusado e caso de borda.

## Revisão cruzada (quem não implementou revisa)

Saída curta, por severidade (alta, média, baixa): `arquivo:linha — problema — cenário que quebra — correção sugerida`. Sem "considere talvez". Se não achou nada grave, diga isso em uma linha. Distinga gasto à toa de tokens (contexto inchado, leitura repetida) de uso indevido de credencial (chave exposta, envio a serviço não autorizado): o segundo é sempre severidade alta.

## Skills de apoio (só se instaladas e só quando o caso pede)

Cada uma custa de 2 a 5 mil tokens ao abrir; use uma por vez.
- Segurança do diff: `differential-review` (Trail of Bits). Padrões inseguros: `insecure-defaults`. Dependências: `supply-chain-risk-auditor`.
- Desenho de API: `api-and-interface-design` (Addy Osmani). Desempenho: `performance-optimization`.
