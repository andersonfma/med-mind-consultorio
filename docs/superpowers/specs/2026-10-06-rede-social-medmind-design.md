# Rede social Med Mind — design

Data: 2026-10-06
Status: aprovado no brainstorming; aguardando revisão da spec antes do plano de implementação.

## Objetivo e papel

Transformar o Med Mind de ferramenta de treino em uma **rede social de engajamento** para
estudantes de medicina, construída sobre o que já existe (XP, ranking, card
compartilhável). O **papel principal é engajamento / retorno diário** (hábito): ver amigos
treinando, stories, reações rápidas, ranking entre quem você segue. Aprendizado entre pares
(dúvidas/comentários) e aquisição (compartilhar pra fora) são camadas secundárias, mas entram
no alvo de lançamento.

Casos clínicos são **simulados** — não há dado de paciente real em lugar nenhum. O dado
pessoal sensível que a rede introduz é a identidade do estudante (nome/foto, opcional).

### Métrica de sucesso
- DAU e dias seguidos de uso (streak implícito pelo hábito).
- Retorno no dia seguinte (D1) de quem interagiu (recebeu curtida/comentário/seguidor).
- Secundário: cadastros vindos de compartilhamento externo (fatia 4).

## Decisões de produto (travadas no brainstorming)

1. **Identidade à escolha de cada usuário**: modo `real` (nome + foto) ou `alias` (apelido +
   avatar gerado). Os dois modos precisam funcionar bem.
2. **Grafo = seguir (assimétrico, estilo IG)**. Perfil público → segue direto; perfil privado
   → solicitação que o dono aprova. É daí que sai a tela de "solicitações".
3. **Conteúdo no alvo de lançamento** (todos): post com card de resultado, curtir + comentar,
   stories efêmeros (24h), post de texto/dúvida.
4. **Moderação = piso essencial**: denunciar (post/comentário), bloquear usuário, fila de
   denúncias no `/admin` com remoção/ocultação manual, termos de uso no cadastro. Sem filtro
   automático de IA por ora.
5. **O card mostra o diagnóstico só quando ele foi alcançado/revelado** (o gate atual de
   `/api/share` está correto e não muda). Antes disso, mostra a especialidade.
6. **Spec cobre a rede inteira; implementação sai em fatias** que vão a produção uma a uma,
   na ordem "esqueleto social primeiro".

## Arquitetura de dados (Supabase, com RLS)

Todas as tabelas novas têm RLS habilitada. Service role (`createAdminClient`) enxerga tudo
para a fila de moderação. Migrations entram uma por fatia (a tabela de cada fatia na migration
daquela fatia), nunca todas de uma vez.

### `profiles` (estende a tabela existente)
- `identity_mode` TEXT `'real' | 'alias'` DEFAULT `'alias'`.
- `handle` TEXT único **nullable** (slug para a URL `/u/<handle>`; validado
  `^[a-z0-9_.]{3,30}$`). Perfis existentes nascem com `handle` nulo (vários nulos são
  permitidos no índice único do Postgres); definir um `handle` é pré-requisito para publicar o
  primeiro post (o editor de perfil cobra, sugerindo um a partir do e-mail).
- `display_name` TEXT (nome exibido quando `identity_mode='real'`).
- `avatar_url` TEXT (foto quando `real`; quando `alias`, avatar é gerado de iniciais/cor, sem
  armazenar imagem).
- `bio` TEXT.
- `is_private` BOOLEAN DEFAULT false.
- Reaproveita `leaderboard_optin` / `leaderboard_alias` já existentes (o apelido do ranking é o
  mesmo apelido do modo `alias`).

Regra de exibição central (função pura reutilizável `displayIdentity(profile)`): `real` →
`display_name` + `avatar_url`; `alias` → `leaderboard_alias` (ou "Aluno") + avatar gerado. O
ranking passa a usar a mesma função para consistência.

### `follows`
- `follower_id` UUID, `followee_id` UUID, `status` TEXT `'pending' | 'accepted'`,
  `created_at`. PK composta (follower, followee). CHECK `follower_id <> followee_id`.
- Perfil público do followee → insere `accepted`. Privado → `pending`.

### `posts`
- `id`, `author_id`, `kind` TEXT `'card' | 'text'`, `created_at`, `hidden_at` TIMESTAMPTZ null.
- `consultation_id` UUID null (quando o card é de uma consulta).
- `ranking_snapshot` JSONB null (quando o card é da posição no ranking: período, posição, xp —
  congelado no momento do post).
- `body` TEXT (legenda do card, ou o texto da dúvida quando `kind='text'`).
- Invariante: `kind='card'` exige `consultation_id` OU `ranking_snapshot`; `kind='text'` exige
  `body` não vazio.

### `post_reactions`
- `post_id`, `user_id`, `created_at`. UNIQUE (post_id, user_id) — curtir é idempotente.

### `comments`
- `id`, `post_id`, `author_id`, `body`, `created_at`, `hidden_at` TIMESTAMPTZ null.

### `stories`
- `id`, `author_id`, `kind` TEXT `'card' | 'image'`, `created_at`, `expires_at` (= created +
  24h), `consultation_id` null / `media_url` null, `caption` TEXT.
- Feed de stories filtra `expires_at > now()`. Limpeza preguiçosa (a query já esconde
  expirados; remoção física pode ser um job posterior, não é pré-requisito).

### `reports`
- `id`, `target_type` TEXT `'post' | 'comment'`, `target_id` UUID, `reporter_id`, `reason`
  TEXT, `status` TEXT `'open' | 'resolved'` DEFAULT `'open'`, `created_at`.

### `blocks`
- `blocker_id`, `blocked_id`, `created_at`. UNIQUE (blocker, blocked). Esconde conteúdo nos
  dois sentidos.

### Storage
- Buckets `avatars` e `story-media`. Upload do cliente por **URL assinada** emitida por rota
  server-side após validar tipo (`image/*`) e tamanho (cap ex. 5 MB). Nada de áudio/vídeo no MVP.

### Privacidade via RLS (a parte mais delicada — especificada explicitamente)
Um **post é visível** para o usuário atual quando TODAS valem:
- `hidden_at` é nulo (não moderado), E
- não existe `block` entre autor e usuário atual em nenhum sentido, E
- o autor é o próprio usuário, OU o autor tem `is_private=false`, OU existe `follows` com
  `status='accepted'` do usuário atual para o autor.

`comments` e `post_reactions`: só pode ler/escrever quem pode ver o post pai. `stories`: mesma
regra do post + `expires_at > now()`. `follows`: o usuário vê/gerencia os follows em que é
follower ou followee. `reports`: insere qualquer um autenticado; lê só service role.
`blocks`: o usuário gerencia os próprios. As regras de visibilidade ficam também em uma
**função pura `canSeePost(viewer, author, follow, blocks)`** espelhando a policy, para teste
unitário e para montar queries no servidor (a RLS é a rede de segurança; a função é a lógica
testável).

## Fatias de implementação (ordem: esqueleto social primeiro)

Cada fatia: migration própria, TDD, `tsc`/eslint/build limpos, deploy via webhook, confirma
por `/api/version`. Cada fatia é um incremento que vai a produção sozinho.

### Fatia 1 — Perfil + seguir + feed de cards + curtir + comentar (+ denunciar/bloquear)
O menor laço que já parece rede.

**Telas**
- `/u/[handle]` — perfil: identidade (via `displayIdentity`), bio, contadores
  (seguidores · seguindo · posts), botão **Seguir / Seguindo / Solicitado**, grade de posts.
  Dono vê "Editar perfil".
- `/perfil/editar` — escolhe `identity_mode`; `real` → `display_name` + upload de foto;
  `alias` → usa apelido + avatar gerado; edita `handle`, `bio`, toggle `is_private`.
- `/feed` — posts de quem você segue (`accepted`) + os seus, cronológico, paginado. Card-post
  exibe a **imagem do card existente** (`/api/share/[consultationId]` ou um render de snapshot
  de ranking) + legenda + curtir + contador de comentários.
- `/post/[id]` — o post + curtidas + thread de comentários.
- `/solicitacoes` — só perfil privado: aprova/recusa quem pediu pra seguir.

**Fluxos**
- Virar post: no fim da consulta (ponto já existente) **e** por uma área **"Meus resultados"**
  (histórico de consultas finalizadas — resolve o "sair e voltar e postar quando quiser").
  Também "postar posição no ranking" (snapshot). A imagem do card de ranking vem de uma rota
  `next/og` espelhando `/api/share` (ex. `/api/share/ranking`), parametrizada pelo snapshot.
- Seguir: público → `accepted`; privado → `pending` → Solicitações.
- Curtir/comentar; denunciar (menu "⋯" em post/comentário); bloquear no perfil.

**Rotas/APIs**: `POST/DELETE /api/follow`, `POST /api/follow/[id]/approve`,
`POST /api/posts`, `POST/DELETE /api/posts/[id]/like`, `POST /api/posts/[id]/comments`,
`POST /api/reports`, `POST/DELETE /api/blocks`, `PATCH /api/profile`, rota de URL assinada p/
avatar. Header ganha **Feed** + avatar do usuário.

**Migration 1**: `profiles` (novas colunas), `follows`, `posts`, `post_reactions`,
`comments`, `reports`, `blocks` + policies + bucket `avatars`.

### Fatia 2 — Stories (24h) + notificações
- Barra de stories no topo do feed; visualizador toque-a-toque; story de card ou imagem.
- `notifications` (`user_id`, `type` `'follow' | 'like' | 'comment'`, `actor_id`,
  `target_id`, `read_at`) + lista + badge de não-lidas. Tempo real (Supabase Realtime) é
  opcional; MVP usa carregamento ao abrir / polling leve.
- **Migration 2**: `stories` + bucket `story-media`, `notifications`.

### Fatia 3 — Post de texto/dúvida
- Compositor de texto; `kind='text'`; mesma mecânica de curtir/comentar; selo opcional "dúvida".
- Sem migration (reusa `posts`).

### Fatia 4 — Descoberta + aquisição
- Sugestões de quem seguir (topo do ranking, colegas).
- Compartilhar card/perfil **pra fora quando quiser** (Web Share + fallback).
- **Página pública** do card e do perfil com CTA **"criar conta"** (link de cadastro para
  quem recebe de fora). Reusa `/api/share` + rota pública (api routes já não passam pelo
  redirect de auth do proxy).
- Sem migration (ou só índices de sugestão).

### Fatia 5 — Moderação /admin completa
- Fila de denúncias no `/admin` (aba): lista `reports` abertos com link ao conteúdo, ações
  ocultar/remover (`hidden_at`) e resolver. Histórico. (Denunciar/bloquear já existem desde a
  fatia 1.)
- Sem migration (reusa `reports`/`hidden_at`).

## Tratamento de erro
- Ações críticas (seguir, postar, comentar, editar perfil) retornam erro claro ao cliente.
- Não-críticas (gravar notificação, limpeza de story) são best-effort (try/catch), não quebram
  o fluxo principal.
- Uploads validam tipo/tamanho; falha → mensagem clara, sem publicar.
- Idempotência: curtir e seguir são únicos no banco (unique constraint); repetir não duplica.
- RLS é a rede de segurança final: mesmo com bug de query, o banco não vaza conteúdo privado.

## Testes
- Funções puras testadas: `canSeePost`, `displayIdentity`, resolução de status de follow
  (público vs privado), expiração de story, montagem do feed.
- Policies RLS verificadas (um usuário não lê post privado de quem não segue; bloqueio esconde
  nos dois sentidos).
- TDD nas rotas, no padrão do resto do projeto (vitest). Sem eval de IA (não há geração de IA
  nova nesta rede; o filtro de IA ficou fora do escopo).

## Fora do escopo (YAGNI)
DM/chat privado, grupos, filtro automático de IA de conteúdo, feed algorítmico (fica
cronológico), vídeo em stories (só imagem/card), repost interno, hashtags/busca full-text.
Tudo reavaliável depois do MVP.

## Observações de implementação herdadas do projeto
- Deploy por webhook (`curl .../api/deploy/<hash>`), confirma por `/api/version` (builtAt só é
  sinal confiável em commit NOVO; rebuild do mesmo commit = no-op por cache de layer).
- Colunas novas fora dos tipos gerados: `as never` em updates, cast em leituras, `.select('*')`.
- Migrations: PostgREST não faz DDL — aplicar no SQL editor do Supabase.
- Nunca passar função como prop de Server→Client Component; usar `router.refresh()`.
