---
name: seo-tecnico
description: SEO técnico para páginas públicas indexáveis (robots.txt, sitemap.xml, JSON-LD Schema.org, canonical, title e meta description, HTML semântico, avaliação de llms.txt) e o tratamento certo para sistemas internos e áreas logadas (noindex). Use ao criar ou alterar páginas públicas, ou ao expor um sistema interno na internet.
---

# SEO técnico

## 1. Classifique primeiro

- **Sistema interno, área logada, painel, tela de login**: não indexar. `robots.txt` com `Disallow: /`, `<meta name="robots" content="noindex, nofollow">` (ou cabeçalho `X-Robots-Tag: noindex`), sem sitemap e sem JSON-LD. Termina aqui.
- **Página pública** (site, landing, página de download para clientes, blog): siga a seção 2.

robots.txt e noindex não protegem nada: conteúdo sensível precisa de login.

## 2. Página pública

1. **robots.txt** na raiz: libera o público, bloqueia área logada e API, e aponta `Sitemap: https://dominio/sitemap.xml`.
2. **sitemap.xml**: só URLs canônicas e indexáveis (respondem 200, sem noindex), com `<lastmod>` real. Gerado no build quando as páginas vêm de dados.
3. **JSON-LD (Schema.org)**: o tipo que descreve o negócio e a página de verdade (ex.: `ExerciseGym` ou `LocalBusiness` com endereço, horário e telefone reais; `SoftwareApplication`; `BreadcrumbList`). `FAQPage` só se as perguntas estiverem visíveis na página. Nunca marcar o que a página não mostra.
4. **canonical**: `<link rel="canonical" href="URL absoluta">` em toda página; uma URL principal por conteúdo (barra no fim, http/https, parâmetros).
5. **title** (cerca de 50 a 60 caracteres) e **meta description** (cerca de 120 a 160) únicos por página, descrevendo o conteúdo e a intenção de busca. Nada de lista de palavras-chave.
6. **HTML semântico**: um `h1` por página, títulos sem pular nível, `header`, `nav`, `main`, `footer`; `a` para navegar e `button` para ação; `alt` em imagem informativa; `lang` no `<html>`.
7. **llms.txt**: proposta não oficial; nenhum buscador garante que usa. Só faz sentido em site com documentação ou conteúdo que alguém vá consumir por IA. Não prometer ganho de indexação ou visibilidade.

## 3. Validação

- `curl -s URL/robots.txt` e `curl -s URL/sitemap.xml | head`.
- Conferir canonical, title, description e JSON-LD no HTML servido, não só no código-fonte. Em SPA, se o conteúdo só aparece com JavaScript, avaliar pré-renderização.
- JSON-LD no validator.schema.org ou no Rich Results Test; Lighthouse (SEO e acessibilidade) nas páginas públicas.
