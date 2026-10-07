---
name: verificar-interface
description: Valida telas novas ou alteradas em 6 tamanhos de referência (2 pequenos, 2 médios, 2 grandes) mais celular e tablet deitados - texto cortado, rolagem lateral, elemento fora da tela, sobreposição, alvo de toque, contraste, foco por teclado, modal e erro de console. Use ao criar ou mudar qualquer interface, antes de dar a tarefa por concluída.
---

# Verificar interface

## Tamanhos de referência (px CSS)

| Código | Dimensão | Representa |
|---|---|---|
| P1 | 360×800 | celular Android pequeno (pior caso de largura) |
| P2 | 393×852 | celular médio atual |
| M1 | 768×1024 | tablet em pé |
| M2 | 1280×800 | tablet 10" deitado / notebook pequeno |
| G1 | 1440×900 | notebook |
| G2 | 1920×1080 | monitor Full HD |
| P1d, M1d | 800×360, 1024×768 | P1 e M1 deitados (telas usadas em celular/tablet) |

P1–M1 e os deitados simulam toque; M2–G2 simulam mouse e teclado.

## Profundidade proporcional à mudança

- Texto, cor ou espaçamento numa tela: só essa tela em P1, M1 e G1.
- Componente compartilhado (modal, menu, botão, formulário, tema): todas as telas que o usam, nos 8 tamanhos.
- Tela ou fluxo novo: 8 tamanhos e o fluxo percorrido no roteiro (abrir, preencher, salvar, cancelar, erro).
- Só backend: não precisa.

## Como rodar

Use o comando do projeto (AGENTS.md › Testes). Sem comando próprio, o genérico (Node 22+, sem dependências, usa o Chrome ou o Edge instalado, ou `CHROME_PATH`):

```
node .agents/skills/verificar-interface/scripts/auditar-telas.mjs --url http://localhost:PORTA [--roteiro roteiro.json] [--tamanhos P1,M1,G1] [--saida pasta]
```

O formato do roteiro (login, passos por tela) está no cabeçalho do script.

Economia de tokens:
- Leia o resumo do terminal: ele já agrupa o mesmo problema em vários tamanhos numa linha.
- Abra uma foto (`<saida>/<tamanho>/<tela>.png`) só para confirmar um problema específico; cada imagem custa cerca de 1,5 mil tokens.
- Não cole o `relatorio.json` inteiro na conversa; filtre o que precisa.

## Severidade

- **Erro** (corrigir antes de entregar): rolagem lateral, elemento fora da tela, texto cortado, elemento coberto, sem nome acessível, imagem sem `alt`, contraste abaixo de 3:1, alvo menor que 24 px no toque, foco que sai do modal, exceção de JavaScript, passo do roteiro que falhou.
- **Aviso** (avaliar; corrigir se for barato ou se a mudança piorou): alvo menor que 44 px no toque, fonte menor que 12 px, contraste entre 3 e 4,5:1 em texto normal, foco sem contorno, item atrás de barra fixa, falha de rede esperada (ex.: 401 antes do login).
- Ao mexer em tema ou componente compartilhado, compare a contagem com a da `main`: não piore.

## O que a ferramenta não vê

Confira na foto ou percorrendo a tela:
- hierarquia, alinhamento, proporção e espaçamento coerente (skill `direcao-de-design`);
- estados: hover, pressionado, desabilitado, carregando, vazio, erro;
- menus abrindo e fechando, formulários com erro de validação, modais fechando com Esc e devolvendo o foco;
- o fluxo principal completo funcionando.

## Na entrega

Uma linha: `Telas: N combinações, 0 erros; avisos: X (iguais à main | novos: ...)`.
