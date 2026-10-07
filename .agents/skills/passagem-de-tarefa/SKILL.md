---
name: passagem-de-tarefa
description: Divisão de trabalho e formato curto de comunicação entre Claude e Codex - quem implementa e quem revisa, meta de 50% para cada um, mensagem de passagem, retorno com validações e bloqueios, sem repassar histórico. Use ao delegar, receber ou entregar trabalho entre os dois agentes.
---

# Passagem de tarefa (Claude e Codex)

## Divisão (meta: 50% do esforço para cada um)

- Quem implementa não revisa a própria entrega: o outro faz a revisão cruzada.
- Tamanho da tarefa em pontos: P = 1, M = 2, G = 4. A revisão vale metade dos pontos da tarefa.
- Afinidade, quando a escolha for livre:
  - Claude: telas e experiência (com a verificação nas 6 telas), textos e documentação para o usuário, planejamento de tarefa grande.
  - Codex: backend, segurança, revisão adversarial, testes de regra de negócio, scripts e automação.
- A afinidade cede à meta: se um lado acumulou mais pontos no mês, o outro pega a próxima tarefa, mesmo fora da afinidade.
- Os dois nunca fazem a mesma tarefa ao mesmo tempo (revisão não conta como fazer).
- Registro: uma linha por tarefa no fim de `.agentes/registro.md`. É o que mede o 50%; não registre mais nada ali.

## Mensagem de passagem (até 15 linhas)

```
TAREFA: <verbo + objeto, em uma linha>
POR QUÊ: <objetivo e o contexto que muda a decisão; link de issue/PR se houver>
RESPONSÁVEL: <Claude|Codex> implementa · <o outro> revisa · tamanho P|M|G
ESCOPO: faz <...> · não faz <...>
ARQUIVOS: <caminhos ou componentes; por onde começar>
PRONTO QUANDO: <critérios verificáveis: testes, telas, comportamento>
JÁ SABIDO: <fatos verificados e decisões tomadas, para não refazer>
```

Não incluir: histórico da conversa, análise já concluída, código inteiro (aponte `arquivo:linha`), repetição do que está no AGENTS.md.

## Retorno (até 10 linhas)

```
RESULTADO: feito | parcial | bloqueado · commit ou PR
MUDOU: <arquivos e o essencial>
VALIDADO: <comandos rodados e resultado; telas: N combinações, 0 erros>
FALTA/BLOQUEIO: <o quê, por quê, o que destrava>
```

## Por onde a mensagem vai

- Mesma máquina: o Claude chama o Codex pelo plugin `openai/codex-plugin-cc` (`/codex:review`, `/codex:adversarial-review`, `/codex:rescue`) com a mensagem acima. O Codex lê o diff sozinho; não cole o diff.
- Entre aplicativos ou sessões na nuvem: a mensagem vai na descrição do PR, ou em `.agentes/tarefas/<slug>.md`, apagado quando o PR fecha (o git guarda o histórico).
