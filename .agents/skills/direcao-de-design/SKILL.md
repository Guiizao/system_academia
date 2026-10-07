---
name: direcao-de-design
description: Critérios de direção visual para criar ou revisar interfaces com identidade e consistência, evitando padrões genéricos - gradiente roxo, card dentro de card, cantos exagerados, brilho em tudo, emoji no lugar de ícone, texto demais em card, gráfico sem função, tudo centralizado, muitos estilos de botão, selo "Powered by AI". Use ao desenhar telas, componentes ou temas e ao revisar o visual de uma entrega.
---

# Direção de design

Cada escolha visual precisa de um motivo ligado à identidade do projeto ou ao uso. Os 10 critérios abaixo servem para avaliar, não são proibições: se usar um deles, escreva o motivo em uma linha na entrega.

## Antes de desenhar

1. Leia os tokens do projeto (cores, fonte, espaçamento, raio, sombra) e reutilize. Valor fora da escala só com motivo.
2. Quem usa, onde e como. Ex.: operador de usina com luva, tablet na parede e luz forte pedem alvo grande e contraste alto; recepção da academia no PC aceita mais densidade e atalhos de teclado.
3. Uma tela, uma tarefa principal: o que a pessoa precisa decidir ou fazer aqui?

## Critérios de revisão

| # | Evitar por padrão | Pergunta |
|---|---|---|
| 1 | Gradiente roxo em tudo | A cor vem da identidade do projeto? O gradiente comunica algo? |
| 2 | Card dentro de card | O agrupamento precisa de borda e fundo, ou espaço e título resolvem? |
| 3 | Cantos muito arredondados | O raio segue a escala do projeto, igual em botão, campo e card? |
| 4 | Brilho e efeito em qualquer elemento | O efeito indica estado ou hierarquia? Respeita `prefers-reduced-motion`? |
| 5 | Emoji no lugar de ícone | Existe ícone do conjunto do projeto, com nome acessível? |
| 6 | Texto demais em card | Cabe numa leitura rápida? O detalhe pode ir para a tela seguinte? |
| 7 | Gráfico decorativo | Ajuda a comparar, ver tendência ou decidir? Tem eixo, legenda ou valor? Senão, número ou tabela. |
| 8 | Tudo centralizado | Texto longo e formulário alinhados à esquerda; centro só para peça curta e isolada. |
| 9 | Muitos estilos de botão | No máximo principal, secundário, perigo e texto; um principal por área. |
| 10 | Selo "Powered by AI" | Ajuda a pessoa a decidir algo? Senão, remover. |

## Detalhes que fazem diferença

- Hierarquia por tamanho, peso e espaço antes de cor.
- Espaçamento em escala (4, 8, 12, 16, 24, 32) e alinhado a uma grade.
- Números de tabela alinhados à direita, com `font-variant-numeric: tabular-nums`.
- Estados completos: hover, foco visível, pressionado, desabilitado, carregando, vazio e erro.
- Movimento curto (150 a 250 ms), com propósito, desligado por `prefers-reduced-motion`.
- Validar em telas reais com a skill `verificar-interface`.

## Referências (consultar, não instalar no projeto)

- Movimento: `kylezantos/design-motion-principles` (auditoria de animação).
- Estudo de sistemas de design: `VoltAgent/awesome-claude-design` (DESIGN.md de marcas conhecidas; estudar, não copiar identidade de terceiros).
- Extrair tokens de um site próprio: extensão do Chrome `bergside/design-md-chrome` (roda local, sem enviar dados).
