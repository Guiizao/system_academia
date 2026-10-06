# Sistema DARK FISIC — Núcleo (#1)

**Data:** 2026-09-08
**Status:** Aprovado para planejamento
**Escopo:** Backend, banco de dados, motor de IA de treino, frontend mobile+desktop, deploy

---

## 1. Contexto

Existe um protótipo funcional em `dark-fisic-sistema-3.html`: arquivo único, mobile-only
(430px), estado inteiro em `localStorage`, dados de demonstração. Ele define a identidade
visual, as telas e o vocabulário do produto, mas não tem backend, não persiste de verdade
e não tem regras de negócio confiáveis.

Este documento especifica o sistema real que substitui esse protótipo, preservando seu
visual e sua estrutura de telas.

O projeto é dividido em três ciclos independentes. **Esta spec cobre apenas o #1.**

| # | Ciclo | Situação |
|---|---|---|
| 1 | Núcleo: dados, API, IA de treino, frontend, deploy | **esta spec** |
| 2 | Automação WhatsApp: cobrança, avisos, Pix, entrega de ficha | spec própria, depois |
| 3 | Bot de consulta dos donos | spec própria, depois |

O #1 precisa deixar os ganchos prontos para #2 e #3 (seção 10), sem construí-los.

---

## 2. Decisões fixadas

| Decisão | Valor | Origem |
|---|---|---|
| Abrangência | Uma academia. Sem multi-tenant. | definida com o cliente |
| Usuários do sistema | Somente equipe: dono, recepção, professor. Alunos não logam. | definida com o cliente |
| Fonte da verdade | Notebook da academia. Back e banco rodam nele. | definida com o cliente |
| Funcionamento sem internet | Obrigatório na rede local | definida com o cliente |
| Acesso externo | Cloudflare Tunnel | definida com o cliente |
| Banco | SQLite (arquivo único) | abordagem A |
| Backend | Node.js + TypeScript + Fastify | abordagem A |
| Frontend | React + TypeScript + Vite, PWA | seção 8 |
| Pix | Chave estática; sistema gera QR e copia-e-cola. Baixa manual. | definida com o cliente |
| Renovação adiantada | Conta do vencimento antigo | definida com o cliente |
| Renovação atrasada | Conta da data do pagamento | definida com o cliente |
| Bloqueio de vencido | Nenhum. Sistema apenas alerta. | definida com o cliente |
| Alimentação da IA | Base curada de fontes confiáveis, aprovada por trainers | definida com o cliente |
| Busca web na geração | Não | seção 7 |

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────┐
│  Notebook da academia (Windows)             │
│                                             │
│   [serviço] app Node ──── API + frontend    │
│        │                                    │
│        ├── SQLite  (academia.db)            │
│        ├── mídia/  (vídeos de exercício)    │
│        └── camada de serviços ◄─── job 03h  │
│                                             │
│   [serviço] cloudflared ──── túnel          │
└──────────────────┬──────────────────────────┘
                   │ saída (sem porta aberta)
                   ▼
            Cloudflare  →  academia.<dominio>
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   celular do dono      acesso externo
```

Na rede local, os clientes acessam o IP do notebook diretamente — sem depender do túnel
nem da internet.

### 3.1 Camadas

```
rotas HTTP ─┐
job diário ─┼─► CAMADA DE SERVIÇOS ─► repositórios ─► SQLite
(fase 2) ───┘
bots
```

**Regra dura:** nenhuma regra de negócio dentro de handler HTTP. `renovarMatricula()`,
`gerarCobranca()`, `registrarCheckin()` têm uma implementação só, chamada por vários
consumidores. Isso é o que permite as fases 2 e 3 entrarem sem duplicar lógica.

---

## 4. Modelo de dados

Padrões aplicados a todas as tabelas:

- **Dinheiro:** inteiro em centavos. Nunca float.
- **Telefone:** E.164 (`+5511980001111`).
- **Datas/hora:** UTC no banco, `America/Sao_Paulo` na apresentação.
- **Toda tabela:** `id`, `criado_em`, `atualizado_em`.

### 4.1 Base

**`academia`** (registro único)
`nome, cnpj, endereco, telefone, whatsapp, instagram, responsavel, pix_chave, pix_tipo,
pix_nome_recebedor, pix_cidade, logo_path,
dias_aviso_vencimento (default 5), dias_aluno_sumido (default 10),
volume_max_series_iniciante (default 12), volume_max_series_intermediario (default 18),
volume_max_series_avancado (default 24)`

`pix_nome_recebedor` e `pix_cidade` são obrigatórios para montar o BR Code.

Os tetos de volume são o número máximo de séries por sessão de treino e devem ser
revisados com os trainers antes do go-live; os valores acima são apenas ponto de partida.

**`horario_funcionamento`**
`dia_semana (0-6), aberto, abre, fecha`

**`usuario`**
`nome, email, senha_hash, papel, ativo, cref, especialidade, telefone, ultimo_login`

`papel ∈ {dono, recepcao, professor}`. Professor que não loga tem `senha_hash` nulo.
Não existe tabela separada de professores — evita divergência entre as duas listas.

**`log_auditoria`**
`usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois, ip`

Registra toda alteração em dinheiro, matrícula, aluno e ficha.

### 4.2 Alunos

**`aluno`**
`nome, cpf, data_nascimento, sexo, telefone, email, endereco, observacoes_medicas,
restricoes (json: array de tags), foto_path, aceita_whatsapp, consentimento_lgpd_em,
ativo`

Não contém status, plano nem medidas — todos derivados ou historiados.

**`tag_restricao`** (tabela de referência)
`codigo, rotulo`

Valores iniciais: `joelho, ombro, lombar, cervical, punho, tornozelo, quadril,
hipertensao, cardiaco, gestante, hernia, diabetes`.

Restrição precisa ser tag padronizada, não texto livre — texto livre não filtra.
`observacoes_medicas` continua existindo em paralelo, para leitura humana.

**`avaliacao_fisica`**
`aluno_id, data, peso_kg, altura_m, perc_gordura, circ_braco, circ_peito, circ_cintura,
circ_quadril, circ_coxa, circ_ombros, objetivo, nivel, avaliador_usuario_id, observacoes`

Histórico. Nova avaliação nunca sobrescreve a anterior. IMC é calculado, nunca gravado.
`objetivo ∈ {hipertrofia, emagrecimento, definicao, condicionamento, saude_geral,
reabilitacao}`, `nivel ∈ {iniciante, intermediario, avancado}`.

### 4.3 Contrato e dinheiro

**`plano`**
`nome, preco_centavos, duracao_meses, descricao, beneficios (json), ativo, destaque, ordem`

**`matricula`**
`aluno_id, plano_id, data_inicio, data_fim, dia_ancora, valor_centavos,
forma_pagamento_preferida, status, observacao`

`status ∈ {ativa, encerrada, cancelada}`. `valor_centavos` é cópia do preço no momento
da contratação — mudança de tabela de preços não reescreve o passado.
`dia_ancora` guarda o dia original do mês (ver 5.2).

**`cobranca`**
`matricula_id, aluno_id, competencia, valor_centavos, vencimento, status, pix_txid,
pix_payload, pix_qr_path`

`status ∈ {aberta, paga, cancelada}`. Vencida é derivado (`aberta` + `vencimento < hoje`).
A cobrança existe mesmo sem pagamento — é ela que define inadimplência e é ela que o bot
da fase 2 envia.

**`pagamento`**
`cobranca_id (nullable), aluno_id, valor_centavos, forma, data_pagamento,
registrado_por_usuario_id, observacao`

`forma ∈ {pix, dinheiro, credito, debito, boleto}`. `cobranca_id` nulo = pagamento avulso.

### 4.4 Frequência

**`checkin`**
`aluno_id, data_hora, atividade, origem, registrado_por_usuario_id`

`origem ∈ {manual, qr, catraca}`. Índices em `(aluno_id, data_hora)` e `(data_hora)`.

### 4.5 Treino

**`equipamento`** — `nome, quantidade, ativo`

**`exercicio`**
`nome, grupo_muscular, padrao_movimento, equipamento_id, nivel_minimo, unilateral,
descricao_execucao, contraindicacoes (json: array de tags), series_min, series_max,
reps_min, reps_max, descanso_seg_min, descanso_seg_max, video_path, thumb_path,
animacao_path, duracao_seg, ativo, criado_por_usuario_id, aprovado_por_usuario_id, fonte`

`padrao_movimento ∈ {empurrar_horizontal, empurrar_vertical, puxar_horizontal,
puxar_vertical, agachar, dobradica_quadril, core, isolado, cardio}` — usado na
validação de equilíbrio (5.5).

`contraindicacoes` usa os mesmos códigos de `tag_restricao`.
`animacao_path` fica reservado; animações anatômicas licenciadas são item futuro.

**`conhecimento_treino`**
`titulo, conteudo, fonte_url, fonte_tipo, aplicavel_objetivos (json),
aplicavel_niveis (json), aprovado_por_usuario_id, aprovado_em, ativo`

`fonte_tipo ∈ {diretriz, revisao_sistematica, livro, consenso}`.
Somente registros com `aprovado_por_usuario_id` preenchido entram no contexto da IA.

**`ficha_treino`**
`aluno_id, avaliacao_id, objetivo, nivel, dias_por_semana, status, gerada_por, modelo_ia,
criado_por_usuario_id, aprovada_por_usuario_id, aprovada_em, valida_ate,
feedback_aluno, feedback_professor, encerrada_em, motivo_encerramento`

`status ∈ {rascunho, aprovada, arquivada}`, `gerada_por ∈ {ia, manual, template}`.
Os quatro últimos campos são os ganchos de medição de resultado (não usados no #1).

**`ficha_divisao`** — `ficha_id, rotulo, foco, ordem`

**`ficha_item`**
`divisao_id, exercicio_id, ordem, series, reps, descanso_seg, carga_orientacao, observacao`

**`exercicio_id` é FK obrigatória.** É a trava física que impede a IA de prescrever
exercício fora da biblioteca aprovada.

**`ficha_link`** — `ficha_id, token, expira_em, acessos, ultimo_acesso_em`

Token aleatório ≥128 bits. Página pública somente leitura, para a fase 2 entregar a ficha.

**`template_treino`** — `nome, objetivo, nivel, dias_por_semana, estrutura (json), ativo`

Fallback offline e ponto de partida manual.

### 4.6 Aulas

**`aula`** (molde recorrente)
`nome, dia_semana, hora, duracao_min, professor_usuario_id, vagas, local, ativo`

**`sessao_aula`** (ocorrência real)
`aula_id, data, hora, professor_usuario_id, vagas, status`

`status ∈ {agendada, realizada, cancelada}`. Geradas pelo job diário com 30 dias de
antecedência.

**`inscricao`** — `sessao_id, aluno_id, status`

`status ∈ {inscrito, presente, falta, cancelado, espera}`. Único por `(sessao_id, aluno_id)`.

### 4.7 Sistema

**`notificacao`** — `tipo, titulo, corpo, aluno_id, lida`

**`mensagem_saida`**
`destinatario, canal, tipo, payload (json), chave_idempotencia (único), status,
tentativas, provedor_msg_id, enviada_em, erro`

`status ∈ {pendente, enviada, falhou, cancelada}`. No #1 o remetente é stub.

**`evento_aluno`** — `aluno_id, tipo, dados (json), origem`

---

## 5. Regras de negócio

### 5.1 Status do aluno (derivado, nunca armazenado)

```
sem matrícula ativa                     → inativo
hoje > data_fim                         → vencido
data_fim - hoje <= dias_aviso (5)       → vencendo
caso contrário                          → ativo
```

Implementação única, consumida por telas, relatórios, job e futuros bots. Não existe
rotina que "atualiza status" — não há o que atualizar. Se o notebook ficar dias
desligado, na volta tudo está correto.

### 5.2 Renovação

```
inicio = max(data_fim_anterior, data_pagamento)
fim    = adicionar_meses(inicio, plano.duracao_meses, dia_ancora)
```

A expressão implementa as duas políticas escolhidas: pagamento adiantado conta do
vencimento antigo; pagamento atrasado conta da data do pagamento.

**`adicionar_meses` ancora no dia original da matrícula.** Matrícula iniciada dia 31:
janeiro → 28/02 (ou 29) → **31/03**, não 28/03. Sem a âncora, o vencimento escorrega
para trás permanentemente e o aluno perde dias todo ano.

Quando o mês de destino não tem o dia âncora, usa o último dia do mês.

### 5.3 Check-in

Sempre permitido, qualquer status (decisão do cliente). A interface de busca exibe o
status de forma destacada — aluno vencido aparece em vermelho com "vencido há N dias"
**antes** da confirmação. Sem bloqueio, a visibilidade é a única defesa contra treinar
inadimplente por meses sem ninguém notar.

### 5.4 Job diário (03:00)

Somente emite eventos; nunca corrige dados.

1. Gera `cobranca` para matrículas que vencem em `dias_aviso_vencimento` dias
2. Enfileira avisos em `mensagem_saida` (idempotente por chave), nos marcos
   `D-dias_aviso_vencimento`, `D-2`, `D-0` e `D+3` relativos ao vencimento
3. Marca "aluno sumido": plano ativo, sem check-in há `dias_aluno_sumido` dias
4. Gera `sessao_aula` para os próximos 30 dias
5. Executa o backup

Se o notebook estava desligado, o job roda no boot e recupera o atraso. A chave de
idempotência garante que nenhum aviso saia duplicado.

### 5.5 Validação de ficha

Aplicada após a geração, antes de virar rascunho:

- Todo `exercicio_id` pertence à lista de candidatos daquela geração
- `series` e `reps` dentro da faixa do próprio exercício
  (`series_min..series_max`, `reps_min..reps_max`)
- Soma de `series` por divisão ≤ `volume_max_series_<nivel>` (config em `academia`)
- Equilíbrio: se há `empurrar_*`, precisa haver `puxar_*` na mesma ficha
- Número de divisões compatível com `dias_por_semana`

Falha → regenera uma vez. Falha de novo → entrega rascunho com os avisos anexados para
o professor resolver manualmente.

### 5.6 Permissões

| Recurso | dono | recepção | professor |
|---|---|---|---|
| Alunos, check-in, avaliações | ✅ | ✅ | ✅ |
| Pagamentos, cobranças | ✅ | ✅ | ❌ |
| Relatório financeiro consolidado | ✅ | ❌ | ❌ |
| Planos, preços, configuração | ✅ | ❌ | ❌ |
| Biblioteca de exercícios, conhecimento | ✅ | ❌ | ✅ |
| Aprovar ficha | ✅ | ❌ | ✅ (com CREF) |
| Usuários | ✅ | ❌ | ❌ |

Aprovação de ficha exige `cref` preenchido no usuário.

---

## 6. Pix

O sistema monta o BR Code (padrão EMV do Banco Central) a partir de `pix_chave`,
`pix_nome_recebedor`, `pix_cidade`, valor e identificador, e gera o QR localmente.
Não depende de internet nem de terceiros.

**Limitação incontornável:** chave estática não notifica pagamento. Confirmação no #1 é
**manual**, feita pela recepção conferindo o **extrato bancário** — nunca o print enviado
pelo aluno. Comprovante de Pix falsificado é trivial de produzir e circula amplamente.

### 6.1 Adaptador

```ts
interface ProvedorPix {
  gerarCobranca(valorCentavos: number, referencia: string):
    Promise<{ payload: string; qrPath: string; txid?: string }>;
  suportaConfirmacaoAutomatica: boolean;
}
```

`PixEstatico` no #1. `PixPSP` na fase 2 (Pix dinâmico com txid + webhook), sem alterar
nenhuma outra parte do sistema.

---

## 7. Motor de IA de treino

### 7.1 Princípio

A filtragem de segurança acontece **em código, antes da chamada ao modelo**. O modelo
nunca recebe um exercício que não pode prescrever — não depende de o modelo obedecer.

```
biblioteca completa
  → remove equipamento inexistente ou inativo na academia
  → remove exercício cuja contraindicação intersecta as restrições do aluno
  → remove exercício acima do nível do aluno
candidatos → contexto do modelo
```

### 7.2 Etapas

| # | Etapa | Onde |
|---|---|---|
| 1 | Filtro de candidatos | código |
| 2 | Monta contexto: perfil + candidatos + conhecimento aprovado | código |
| 3 | Geração com saída estruturada | Claude |
| 4 | Validação (5.5) | código |
| 5 | Nasce `rascunho` → professor com CREF aprova | humano |

### 7.3 Configuração da API

- **Modelo:** `claude-opus-5`. Trocar por `claude-sonnet-5` é decisão do cliente,
  não padrão — envolve segurança física.
- **Saída estruturada:** `output_config: { format: ... }` com JSON schema.
  Não usar `output_format` (depreciado). Não usar texto livre.
- **Thinking:** `{ type: "adaptive" }`.
- **Prompt caching:** biblioteca e conhecimento (estáveis, grandes) antes do perfil do
  aluno (volátil, pequeno). Reduz custo a partir da segunda geração.
- **Chave:** variável de ambiente no servidor. Nunca no cliente.

A sintaxe exata do SDK TypeScript deve ser lida na documentação vigente no momento da
implementação, não reproduzida de memória.

### 7.4 Portão humano

Prescrição de exercício físico é privativa de profissional de Educação Física
(Lei 9.696/1998 — CONFEF/CREF). Ficha só sai de `rascunho` com
`aprovada_por_usuario_id`, CREF e data gravados.

**Orientação nutricional está fora do escopo do gerador** — prescrição de dieta é
privativa de nutricionista (CFN). O protótipo pedia "dica nutricional" no prompt; isso
não é portado. Admite-se apenas orientação genérica de hidratação e sono.

Casos com restrição de reabilitação são sinalizados para montagem manual; o gerador não
tenta atendê-los.

### 7.5 Sem internet

Geração exige internet. Indisponível → o sistema oferece `template_treino`
pré-aprovado (objetivo × nível × dias) como ponto de partida editável.

### 7.6 Mídia

Vídeos de demonstração são **gravados na própria academia**, nos aparelhos da academia.
Material de terceiros (sites de treino, apps, YouTube) não é utilizado — é obra
protegida, e redistribuí-la aos alunos expõe a academia.

Formato **MP4 mudo em loop**, não GIF (arquivo ~10× menor, reproduz inline).
Arquivos em disco, caminho no banco — binário dentro do SQLite incha o arquivo e
compromete o backup.

A tela de cadastro de exercício com upload entra no #1 para os trainers começarem a
gravar desde o início. O acervo (~300 clipes) é o item de maior prazo do projeto e não
depende de código.

---

## 8. Frontend

### 8.1 Larguras

| Faixa | Navegação | Layout | Modal |
|---|---|---|---|
| `< 768px` | bottom nav | uma coluna, cards | bottom sheet |
| `768–1023` | sidebar ícones | uma coluna densa | centralizado |
| `≥ 1024px` | sidebar completa | lista + detalhe lado a lado | centralizado |

O desktop não é a tela mobile esticada: usa tabelas ordenáveis e mestre-detalhe, para
que a recepção não perca a lista de vista a cada aluno aberto.

### 8.2 Teclado (recepção)

`/` foca a busca · digitar filtra · `↓` seleciona · `Enter` registra check-in.
Fluxo completo sem mouse, para o horário de pico.

### 8.3 Stack

React + TypeScript + Vite + PWA.

1. **Tipos compartilhados com o backend** — `Aluno`, `Matricula`, `FichaTreino` são a
   mesma definição nos dois lados; divergência quebra a compilação.
2. **XSS** — o protótipo interpola dados em `innerHTML` (ex.: linhas 1231, 1270-1282);
   aluno cadastrado com `<img src=x onerror=…>` executa script na tela da recepção.
   React escapa por padrão.
3. Ecossistema e material de apoio abundantes para manutenção por uma pessoa.

**PWA:** instalável no celular do dono e no notebook da recepção. Service worker guarda
apenas a casca do app e exibe estado explícito de "sem conexão".

**Sem offline-first com sincronização.** Resolução de conflito multiplicaria a
complexidade e não é necessária: a recepção está na mesma rede do servidor, e o celular
sem internet não alcançaria o servidor de qualquer forma.

### 8.4 Identidade visual

A paleta, o tema escuro, as animações e os componentes visuais do protótipo são
preservados. As variáveis CSS existentes (`--blue`, `--tide`, `--deep`, `--ok`,
`--warn`, `--danger`) tornam-se os tokens do design system.

---

## 9. Deploy e operação

### 9.1 Instalação

```
C:\DarkFisic\
  app\      aplicação
  dados\    academia.db
  midia\    vídeos
  backups\
  logs\
```

App e `cloudflared` instalados como **serviços do Windows**. Ligar o notebook coloca o
sistema no ar sem nenhuma ação humana. Depender de alguém clicar em algo significa, mais
cedo ou mais tarde, um dia inteiro sem sistema após uma atualização do Windows.

### 9.2 Túnel

`cloudflared` abre conexão de saída. Não abre porta no roteador, não exige IP fixo e
**funciona atrás de CGNAT** — o que importa no Brasil, onde encaminhamento de porta é
frequentemente impossível. HTTPS pela Cloudflare. Custo: apenas o domínio.

### 9.3 Segurança de exposição

Argon2id, bloqueio progressivo por tentativas, rate limit no login, sessão com
expiração, cookie `httpOnly`+`Secure`+`SameSite`. Cloudflare Access é opcional
(camada extra antes do app) e pode ser ligado depois.

### 9.4 Backup

| Camada | Conteúdo | Frequência |
|---|---|---|
| 1 | `academia.db` para pasta local | diária |
| 2 | Cópia **criptografada** para fora do notebook | diária |
| 3 | Mídia, incremental | semanal |

**Usar `VACUUM INTO`**, não cópia de arquivo — copiar durante uma escrita produz backup
corrompido que só se descobre na hora de restaurar.

**Retenção:** 7 diários + 4 semanais + 12 mensais. Reter apenas o último significa que
um ransomware é fielmente replicado para o backup.

**Restauração testada uma vez, presencialmente, com o dono.**

### 9.5 Atualização

```
backup → para serviço → troca arquivos → migrações (forward-only)
       → sobe serviço → falhou? reverte
```

Backup automático antes de qualquer migração, sem exceção.

### 9.6 Diagnóstico

Página `/status`: versão, tamanho do banco, **data do último backup bem-sucedido**,
estado do túnel, últimos erros. Permite suporte remoto a partir de um print.

### 9.7 Migração para hospedagem paga

Copiar `academia.db` e `midia/` para um VPS. Sem reescrita, sem exportação.

Contrapartida a discutir na ocasião: no VPS o sistema fica sempre acessível, mas a
recepção **para** se a internet da academia cair.

---

## 10. Ganchos para as fases 2 e 3

Construídos no #1, sem funcionalidade de bot:

1. **`mensagem_saida`** — fila com idempotência. No #1 o remetente é stub e as mensagens
   aparecem no painel de notificações. Na fase 2, um worker drena a mesma fila; nenhuma
   outra parte do código muda.
2. **Telefone em E.164** desde o cadastro.
3. **`aceita_whatsapp` + `consentimento_lgpd_em`** coletados na ficha de cadastro desde
   o primeiro aluno. Retroagir significa recontatar a base inteira.
4. **`evento_aluno`** registrando interações.
5. **Camada de serviços** (3.1) — o gancho mais importante.
6. **`/webhooks/pagamento` e `/webhooks/whatsapp`** roteados, respondendo 200, sem lógica.
7. **`ficha_link`** para entrega da ficha por link tokenizado.

### 10.1 Registro para a fase 2

Decisões já levantadas, a confirmar na spec própria:

- **API oficial do WhatsApp (Meta/BSP) é a recomendação.** Bibliotecas não-oficiais
  violam os termos de uso e expõem o número principal da academia a banimento — e o
  padrão de uso previsto (disparo de cobrança para dezenas de pessoas) é justamente o
  de maior risco.
- Mensagem iniciada fora da janela de 24h exige **template pré-aprovado**; os textos de
  D-5, D-2, D-0 e D+3 precisam ser cadastrados antes.
- Para o bot dos donos (#3), **Telegram** é alternativa sem custo por mensagem e sem
  risco de banimento.
- Bot dos donos: **whitelist de números** e **ferramentas de leitura predefinidas**
  (`receitaDoMes()`, `alunosVencendo()`, …). Nunca SQL livre — nome de aluno é entrada
  não confiável e entraria no contexto do modelo.

---

## 11. Segurança e LGPD

Medidas corporais e restrições médicas são **dado pessoal sensível** (LGPD, Art. 5º, II).

- Consentimento registrado com data no cadastro
- Backup criptografado
- `log_auditoria` em alterações de aluno, matrícula, dinheiro e ficha
- Acesso por papel (5.6)
- Link de ficha com token ≥128 bits e expiração
- Exclusão de aluno é lógica (`ativo = false`); remoção definitiva é ação separada,
  restrita ao dono e registrada

---

## 12. Fora de escopo no #1

Explicitamente não construído aqui:

- Envio real de WhatsApp (fase 2)
- Bot de consulta dos donos (fase 3)
- Confirmação automática de Pix / integração com PSP (fase 2)
- Portal com login para alunos (decisão do cliente: alunos não logam)
- Offline-first com sincronização entre dispositivos
- Animações anatômicas licenciadas (adiado pelo cliente)
- Loop de medição de resultado das fichas — apenas os campos são criados
- Multi-tenant / múltiplas academias
- Catraca e leitor de QR físico — `checkin.origem` já prevê, sem integração

---

## 13. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Notebook furtado/quebrado | Perda total | Backup camada 2, diário, fora do notebook |
| Acervo de vídeo não é gravado | Fase 2 sem conteúdo | Tela de upload no #1; começar na primeira semana |
| Biblioteca de exercícios não é alimentada | IA sem candidatos | Carga inicial mínima junto com os trainers antes do go-live |
| Comprovante de Pix falso | Prejuízo | Conferência contra extrato; automação na fase 2 |
| Banimento do WhatsApp | Perda do canal com clientes | API oficial (10.1) |
| Ninguém percebe inadimplente | Receita perdida | Destaque visual no check-in (5.3) |

---

## 14. Questões em aberto

Nenhuma bloqueia o planejamento. Todas são decisões do cliente com prazo posterior:

1. Domínio a registrar para o túnel
2. Se e quando migrar para hospedagem paga
3. PSP a contratar na fase 2
4. Canal do bot dos donos: WhatsApp ou Telegram
5. Compra de pacote de animações anatômicas licenciadas
