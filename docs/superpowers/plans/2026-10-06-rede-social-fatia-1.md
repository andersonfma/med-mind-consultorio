# Rede Social Med Mind — Fatia 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o menor laço social completo — perfil (identidade à escolha), seguir, feed de card-posts, curtir, comentar, com denunciar/bloquear — indo a produção como incremento funcional.

**Architecture:** Next.js 16 App Router + Supabase (RLS como rede de segurança final). Lógica de visibilidade e identidade em funções PURAS testáveis que espelham as policies; rotas server-side validam o usuário via `createClient()` e usam `createAdminClient()` só onde o grant de coluna/linha exige. Páginas são server components dentro de `(dashboard)` (herdam Shell + auth); interações client em componentes isolados que chamam as APIs e dão `router.refresh()`.

**Tech Stack:** Next.js 16 (App Router, proxy.ts), Supabase JS (@supabase/supabase-js, @supabase/ssr), Tailwind v4 (tokens `surface`/`ink`/`muted`/`primary`), vitest (node env + `vi.hoisted` mocks), next/og (card já existente).

**Spec:** `docs/superpowers/specs/2026-10-06-rede-social-medmind-design.md`

## Global Constraints

- pt-BR em toda UI e cópia.
- Casos são simulados; o único dado pessoal novo é identidade do estudante (nome/foto, opcional).
- Colunas novas fora dos tipos gerados: `as never` em payloads de update/insert; leituras com `.select('*')` + cast (`as Record<string, unknown>` / tipo explícito).
- Nunca passar função como prop de Server→Client Component; usar `router.refresh()`.
- Nunca imprimir segredos (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- RLS habilitada em toda tabela nova; a função pura de visibilidade espelha a policy (a policy é a verdade; a função é a lógica testável + montagem de query).
- Migrations: PostgREST não faz DDL — aplicar no SQL editor do Supabase (projeto ref `zrgjsgorijqlqhvlrpdh`).
- Testes de rota seguem o padrão do projeto: `// @vitest-environment node`, `vi.mock('server-only', () => ({}))`, mocks via `vi.hoisted`.
- Identidade exibida SEMPRE via `displayIdentity` (nunca montar nome/avatar ad-hoc) — o ranking existente migra para ela.
- Default de privacidade: `identity_mode='alias'`, perfil público (`is_private=false`).
- Tokens de rota em `src/lib/routes.ts` (não hardcodar paths em componentes).

---

## File Structure

**Criar:**
- `supabase/migrations/20261007120000_social_fatia1.sql` — tabelas + RLS + bucket.
- `src/lib/social/identity.ts` — `displayIdentity`, `isValidHandle`, `suggestHandle`.
- `src/lib/social/identity.test.ts`
- `src/lib/social/visibility.ts` — `canSeePost`, tipos `ViewerContext`.
- `src/lib/social/visibility.test.ts`
- `src/lib/social/types.ts` — tipos de domínio social (ProfileSocial, Post, Comment…).
- `src/app/api/profile/route.ts` — `PATCH` (identidade/handle/bio/privacy).
- `src/app/api/profile/route.test.ts`
- `src/app/api/profile/avatar/route.ts` — `POST` (URL assinada de upload).
- `src/app/api/profile/avatar/route.test.ts`
- `src/app/api/follow/route.ts` — `POST`/`DELETE`.
- `src/app/api/follow/route.test.ts`
- `src/app/api/follow/approve/route.ts` — `POST` (aprova/recusa solicitação).
- `src/app/api/follow/approve/route.test.ts`
- `src/app/api/posts/route.ts` — `POST`.
- `src/app/api/posts/route.test.ts`
- `src/app/api/posts/[id]/like/route.ts` — `POST`/`DELETE`.
- `src/app/api/posts/[id]/like/route.test.ts`
- `src/app/api/posts/[id]/comments/route.ts` — `POST`.
- `src/app/api/posts/[id]/comments/route.test.ts`
- `src/app/api/reports/route.ts` — `POST`.
- `src/app/api/reports/route.test.ts`
- `src/app/api/blocks/route.ts` — `POST`/`DELETE`.
- `src/app/api/blocks/route.test.ts`
- `src/lib/social/feed.ts` — `fetchVisibleFeed(admin, viewerId, cursor)` (monta feed aplicando visibilidade).
- `src/lib/social/feed.test.ts`
- `src/app/(dashboard)/feed/page.tsx` + `FeedList.tsx` + `PostCard.tsx`.
- `src/app/(dashboard)/u/[handle]/page.tsx` + `FollowButton.tsx` + `ProfileActions.tsx` (bloquear).
- `src/app/(dashboard)/post/[id]/page.tsx` + `CommentComposer.tsx` + `LikeButton.tsx` + `ReportMenu.tsx`.
- `src/app/(dashboard)/perfil/editar/page.tsx` + `EditProfileForm.tsx`.
- `src/app/(dashboard)/solicitacoes/page.tsx` + `RequestRow.tsx`.
- `src/app/(dashboard)/resultados/page.tsx` + `PublishResultButton.tsx` (Meus resultados → postar).

**Modificar:**
- `src/lib/routes.ts` — adicionar `FEED_ROUTE`, `profileRoute(handle)`, `postRoute(id)`, `EDIT_PROFILE_ROUTE`, `REQUESTS_ROUTE`, `RESULTS_ROUTE`.
- `src/components/layout/Shell.tsx` — link "Feed" + avatar do usuário (→ perfil/editar).
- `src/lib/scoring/leaderboard.ts` — usar `displayIdentity` para o nome exibido (consistência).

---

## Task 1: Migration — tabelas sociais + RLS + bucket de avatares

**Files:**
- Create: `supabase/migrations/20261007120000_social_fatia1.sql`

**Interfaces:**
- Produces: tabelas `follows`, `posts`, `post_reactions`, `comments`, `reports`, `blocks`; colunas novas em `profiles` (`identity_mode`, `handle`, `display_name`, `avatar_url`, `bio`, `is_private`); bucket `avatars`. Nomes de coluna consumidos por todas as tasks seguintes.

- [ ] **Step 1: Escrever a migration**

```sql
-- Rede social fatia 1: perfis sociais, grafo de seguir, posts, reações, comentários,
-- denúncias e bloqueios. RLS em tudo. Casos são simulados; dado pessoal novo = identidade.

-- 1) Perfil social (estende profiles)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_mode TEXT NOT NULL DEFAULT 'alias'
  CHECK (identity_mode IN ('real','alias'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
-- handle único quando preenchido (múltiplos NULL permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON profiles (handle) WHERE handle IS NOT NULL;

-- 2) Seguir (assimétrico)
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending','accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id, status);

-- 3) Posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('card','text')),
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  ranking_snapshot JSONB,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hidden_at TIMESTAMPTZ,
  CHECK (
    (kind = 'card' AND (consultation_id IS NOT NULL OR ranking_snapshot IS NOT NULL)) OR
    (kind = 'text' AND body IS NOT NULL AND length(btrim(body)) > 0)
  )
);
CREATE INDEX IF NOT EXISTS posts_author_created_idx ON posts (author_id, created_at DESC);

-- 4) Reações (curtir) — idempotente
CREATE TABLE IF NOT EXISTS post_reactions (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- 5) Comentários
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hidden_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS comments_post_created_idx ON comments (post_id, created_at);

-- 6) Denúncias
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Bloqueios
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Helper: existe bloqueio entre a e b (qualquer sentido)?
CREATE OR REPLACE FUNCTION social_blocked(a UUID, b UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;

-- Helper: viewer pode ver o autor? (próprio, ou autor público, ou segue aceito) e sem bloqueio
CREATE OR REPLACE FUNCTION social_can_see_author(viewer UUID, author UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN viewer = author THEN true
    WHEN social_blocked(viewer, author) THEN false
    WHEN EXISTS (SELECT 1 FROM profiles p WHERE p.id = author AND p.is_private = false) THEN true
    WHEN EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = viewer AND f.followee_id = author AND f.status = 'accepted') THEN true
    ELSE false
  END;
$$;

-- follows: o usuário vê/gerencia follows onde é follower ou followee
CREATE POLICY follows_select ON follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);
-- status 'accepted' só se followee é público; privado → só 'pending' (aprovação via update)
CREATE POLICY follows_insert ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND (status = 'pending' OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = followee_id AND p.is_private = false)));
CREATE POLICY follows_update ON follows FOR UPDATE
  USING (auth.uid() = followee_id) WITH CHECK (auth.uid() = followee_id);  -- só o dono aprova
CREATE POLICY follows_delete ON follows FOR DELETE
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);

-- posts: visível por regra de autoria/privacidade/bloqueio; escreve só o próprio
CREATE POLICY posts_select ON posts FOR SELECT
  USING (hidden_at IS NULL AND social_can_see_author(auth.uid(), author_id));
CREATE POLICY posts_insert ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY posts_delete ON posts FOR DELETE
  USING (auth.uid() = author_id);

-- reactions: só em post visível; escreve como si
CREATE POLICY reactions_select ON post_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
CREATE POLICY reactions_insert ON post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
CREATE POLICY reactions_delete ON post_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- comments: ler em post visível; escrever como si em post visível
CREATE POLICY comments_select ON comments FOR SELECT
  USING (hidden_at IS NULL AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
CREATE POLICY comments_insert ON comments FOR INSERT
  WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
CREATE POLICY comments_delete ON comments FOR DELETE
  USING (auth.uid() = author_id);

-- reports: insere qualquer autenticado; SELECT só service role (sem policy de select => negado para anon/auth)
CREATE POLICY reports_insert ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- blocks: gerencia os próprios
CREATE POLICY blocks_all ON blocks FOR ALL
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- Bucket de avatares (público para leitura; escrita por URL assinada emitida pelo servidor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars','avatars', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Aplicar no SQL editor do Supabase**

Abrir `https://supabase.com/dashboard/project/zrgjsgorijqlqhvlrpdh/sql/new`, colar a migration, Run. Esperado: "Success. No rows returned".

- [ ] **Step 3: Verificar as colunas/tabelas via REST (service role do .env.local, sem imprimir a chave)**

Run:
```bash
cd "C:/Users/ander/OneDrive/Documentos/Simulador" && \
SUPA_URL=$(grep -oE "https://[a-z0-9]+\.supabase\.co" .env.local | head -1) && \
SRK=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | head -1 | cut -d= -f2- | tr -d '"'\'' \r') && \
for t in follows posts post_reactions comments reports blocks; do \
  echo -n "$t: "; curl -s -o /dev/null -w "%{http_code}\n" "$SUPA_URL/rest/v1/$t?select=*&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"; done && \
echo -n "profiles.handle: "; curl -s -o /dev/null -w "%{http_code}\n" "$SUPA_URL/rest/v1/profiles?select=handle,identity_mode,is_private&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```
Esperado: todas as linhas `200`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261007120000_social_fatia1.sql
git commit -m "feat(social): migration fatia 1 — perfis sociais, follows, posts, reações, comentários, denúncias, bloqueios + RLS"
```

---

## Task 2: Lib pura — identidade e handle

**Files:**
- Create: `src/lib/social/identity.ts`, `src/lib/social/types.ts`
- Test: `src/lib/social/identity.test.ts`

**Interfaces:**
- Produces:
  - `type ProfileSocial = { id: string; identity_mode: 'real'|'alias'; handle: string|null; display_name: string|null; avatar_url: string|null; bio: string|null; is_private: boolean; leaderboard_alias: string|null; full_name: string|null }`
  - `displayIdentity(p: Pick<ProfileSocial,'identity_mode'|'display_name'|'avatar_url'|'leaderboard_alias'|'full_name'>): { name: string; avatarUrl: string|null; initials: string }`
  - `isValidHandle(h: string): boolean`
  - `suggestHandle(email: string): string`

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// src/lib/social/identity.test.ts
import { describe, it, expect } from 'vitest'
import { displayIdentity, isValidHandle, suggestHandle } from './identity'

describe('displayIdentity', () => {
  it('modo real usa display_name + avatar_url', () => {
    const d = displayIdentity({ identity_mode: 'real', display_name: 'Ana Silva', avatar_url: 'http://x/a.png', leaderboard_alias: 'aninha', full_name: 'Ana S' })
    expect(d.name).toBe('Ana Silva'); expect(d.avatarUrl).toBe('http://x/a.png'); expect(d.initials).toBe('AS')
  })
  it('modo alias usa apelido e NÃO expõe avatar real', () => {
    const d = displayIdentity({ identity_mode: 'alias', display_name: 'Ana Silva', avatar_url: 'http://x/a.png', leaderboard_alias: 'aninha', full_name: 'Ana S' })
    expect(d.name).toBe('aninha'); expect(d.avatarUrl).toBeNull(); expect(d.initials).toBe('A')
  })
  it('alias sem apelido cai em "Aluno"', () => {
    const d = displayIdentity({ identity_mode: 'alias', display_name: null, avatar_url: null, leaderboard_alias: null, full_name: null })
    expect(d.name).toBe('Aluno')
  })
  it('real sem display_name cai no full_name', () => {
    const d = displayIdentity({ identity_mode: 'real', display_name: null, avatar_url: null, leaderboard_alias: null, full_name: 'Bruno Costa' })
    expect(d.name).toBe('Bruno Costa'); expect(d.initials).toBe('BC')
  })
})

describe('isValidHandle', () => {
  it('aceita 3-30 de [a-z0-9_.]', () => { expect(isValidHandle('ana_silva.1')).toBe(true) })
  it('rejeita maiúsculas, espaços, curto demais', () => {
    expect(isValidHandle('Ana')).toBe(false)
    expect(isValidHandle('ab')).toBe(false)
    expect(isValidHandle('a b')).toBe(false)
    expect(isValidHandle('')).toBe(false)
  })
})

describe('suggestHandle', () => {
  it('deriva do local-part do email, saneado', () => {
    expect(suggestHandle('Ana.Silva+test@gmail.com')).toBe('ana.silva')
  })
  it('garante tamanho mínimo com sufixo', () => {
    expect(suggestHandle('a@x.com').length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/social/identity.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/social/types.ts
export type ProfileSocial = {
  id: string
  identity_mode: 'real' | 'alias'
  handle: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  is_private: boolean
  leaderboard_alias: string | null
  full_name: string | null
}

export type PostKind = 'card' | 'text'
export type FollowStatus = 'pending' | 'accepted'
```

```ts
// src/lib/social/identity.ts
type IdInput = {
  identity_mode: 'real' | 'alias'
  display_name: string | null
  avatar_url: string | null
  leaderboard_alias: string | null
  full_name: string | null
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

/** Nome + avatar exibidos, respeitando o modo de identidade. Fonte única de verdade. */
export function displayIdentity(p: IdInput): { name: string; avatarUrl: string | null; initials: string } {
  if (p.identity_mode === 'real') {
    const name = p.display_name?.trim() || p.full_name?.trim() || 'Aluno'
    return { name, avatarUrl: p.avatar_url ?? null, initials: initialsOf(name) }
  }
  const name = p.leaderboard_alias?.trim() || 'Aluno'
  return { name, avatarUrl: null, initials: initialsOf(name) }
}

const HANDLE_RE = /^[a-z0-9_.]{3,30}$/

export function isValidHandle(h: string): boolean {
  return HANDLE_RE.test(h)
}

export function suggestHandle(email: string): string {
  const local = (email.split('@')[0] ?? '').toLowerCase()
  let h = local.replace(/\+.*$/, '').replace(/[^a-z0-9_.]/g, '')
  if (h.length < 3) h = (h + 'aluno').slice(0, 30)
  return h.slice(0, 30)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/social/identity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/identity.ts src/lib/social/identity.test.ts src/lib/social/types.ts
git commit -m "feat(social): lib pura de identidade e handle"
```

---

## Task 3: Lib pura — visibilidade (`canSeePost`)

**Files:**
- Create: `src/lib/social/visibility.ts`
- Test: `src/lib/social/visibility.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Viewer = { viewerId: string }`
  - `type PostAuthorCtx = { authorId: string; isPrivate: boolean; hidden: boolean; follow: 'none'|'pending'|'accepted'; blocked: boolean }`
  - `canSeePost(v: Viewer, c: PostAuthorCtx): boolean` — espelha `posts_select` + `social_can_see_author`.

- [ ] **Step 1: Testes (falhando)**

```ts
// src/lib/social/visibility.test.ts
import { describe, it, expect } from 'vitest'
import { canSeePost } from './visibility'

const base = { authorId: 'a', isPrivate: false, hidden: false, follow: 'none' as const, blocked: false }
const me = { viewerId: 'me' }

describe('canSeePost', () => {
  it('post oculto (moderado) nunca é visível', () => {
    expect(canSeePost(me, { ...base, hidden: true })).toBe(false)
  })
  it('bloqueio esconde mesmo autor público', () => {
    expect(canSeePost(me, { ...base, blocked: true })).toBe(false)
  })
  it('autor público é visível', () => {
    expect(canSeePost(me, base)).toBe(true)
  })
  it('autor privado só com follow aceito', () => {
    expect(canSeePost(me, { ...base, isPrivate: true, follow: 'none' })).toBe(false)
    expect(canSeePost(me, { ...base, isPrivate: true, follow: 'pending' })).toBe(false)
    expect(canSeePost(me, { ...base, isPrivate: true, follow: 'accepted' })).toBe(true)
  })
  it('o próprio autor sempre vê o próprio post (mesmo privado), se não oculto', () => {
    expect(canSeePost({ viewerId: 'a' }, { ...base, isPrivate: true })).toBe(true)
  })
  it('autor não vê o próprio post oculto', () => {
    expect(canSeePost({ viewerId: 'a' }, { ...base, isPrivate: true, hidden: true })).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/social/visibility.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/social/visibility.ts
export type Viewer = { viewerId: string }
export type PostAuthorCtx = {
  authorId: string
  isPrivate: boolean
  hidden: boolean
  follow: 'none' | 'pending' | 'accepted'
  blocked: boolean
}

/** Espelha a policy posts_select + social_can_see_author. A RLS é a verdade; isto é testável. */
export function canSeePost(v: Viewer, c: PostAuthorCtx): boolean {
  if (c.hidden) return false
  if (v.viewerId === c.authorId) return true
  if (c.blocked) return false
  if (!c.isPrivate) return true
  return c.follow === 'accepted'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/social/visibility.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/visibility.ts src/lib/social/visibility.test.ts
git commit -m "feat(social): função pura de visibilidade de post (espelha RLS)"
```

---

## Task 4: `PATCH /api/profile` — identidade, handle, bio, privacidade

**Files:**
- Create: `src/app/api/profile/route.ts`, `src/app/api/profile/route.test.ts`

**Interfaces:**
- Consumes: `isValidHandle` (Task 2), `createClient`, `createAdminClient`.
- Produces: `PATCH` aceita `{ identity_mode?, handle?, display_name?, bio?, is_private? }`. Retorna 200 `{ ok: true }`. 409 em handle duplicado (código `23505`). 422 em handle inválido.

- [ ] **Step 1: Testes (falhando)**

```ts
// src/app/api/profile/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))

const { mockGetUser, mockUpdate } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpdate: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}))

import { NextRequest } from 'next/server'
import { PATCH } from './route'

const req = (b: unknown) => new NextRequest('http://localhost/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
})

describe('PATCH /api/profile', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await PATCH(req({ bio: 'oi' }))).status).toBe(401)
  })
  it('422 handle inválido', async () => {
    expect((await PATCH(req({ handle: 'AB' }))).status).toBe(422)
  })
  it('200 salva campos válidos', async () => {
    const res = await PATCH(req({ identity_mode: 'real', display_name: 'Ana', handle: 'ana.silva', bio: 'x', is_private: true }))
    expect(res.status).toBe(200)
  })
  it('409 em handle duplicado (23505)', async () => {
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { code: '23505' } }) })
    expect((await PATCH(req({ handle: 'ana.silva' }))).status).toBe(409)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/api/profile/route.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/app/api/profile/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidHandle } from '@/lib/social/identity'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.identity_mode === 'real' || body.identity_mode === 'alias') patch.identity_mode = body.identity_mode
  if (typeof body.display_name === 'string') patch.display_name = body.display_name.trim().slice(0, 80) || null
  if (typeof body.bio === 'string') patch.bio = body.bio.trim().slice(0, 280) || null
  if (typeof body.is_private === 'boolean') patch.is_private = body.is_private
  if (typeof body.handle === 'string') {
    const h = body.handle.trim().toLowerCase()
    if (!isValidHandle(h)) return NextResponse.json({ error: 'Invalid handle' }, { status: 422 })
    patch.handle = h
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update(patch as never).eq('id', user.id)
  if (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Handle em uso' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/api/profile/route.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/profile/route.ts src/app/api/profile/route.test.ts
git commit -m "feat(social): PATCH /api/profile (identidade/handle/bio/privacidade)"
```

---

## Task 5: `POST /api/profile/avatar` — URL assinada de upload

**Files:**
- Create: `src/app/api/profile/avatar/route.ts`, `src/app/api/profile/avatar/route.test.ts`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient` (storage).
- Produces: `POST { contentType }` → `{ uploadUrl, path, token, publicUrl }`. Valida `image/*`. O cliente faz PUT direto no `uploadUrl`; depois chama `PATCH /api/profile`? Não — o `avatar_url` final é gravado aqui? Decisão: a rota retorna `publicUrl` e grava `avatar_url=publicUrl` no profile ao emitir (o upload subsequente substitui o arquivo). Caminho fixo `avatars/<userId>.<ext>` (upsert).

- [ ] **Step 1: Testes (falhando)**

```ts
// src/app/api/profile/avatar/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))

const { mockGetUser, mockCreateSignedUploadUrl, mockGetPublicUrl, mockUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(), mockCreateSignedUploadUrl: vi.fn(), mockGetPublicUrl: vi.fn(), mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: { from: vi.fn().mockReturnValue({ createSignedUploadUrl: mockCreateSignedUploadUrl, getPublicUrl: mockGetPublicUrl }) },
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockCreateSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'http://up', token: 'tok', path: 'u1.png' }, error: null })
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://pub/u1.png' } })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
})

describe('POST /api/profile/avatar', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(req({ contentType: 'image/png' }))).status).toBe(401)
  })
  it('415 se não for imagem', async () => {
    expect((await POST(req({ contentType: 'application/pdf' }))).status).toBe(415)
  })
  it('200 retorna uploadUrl e publicUrl e grava avatar_url', async () => {
    const res = await POST(req({ contentType: 'image/png' }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.uploadUrl).toBe('http://up'); expect(j.publicUrl).toBe('http://pub/u1.png')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/app/api/profile/avatar/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { contentType?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const ct = typeof body.contentType === 'string' ? body.contentType : ''
  const ext = EXT[ct]
  if (!ct.startsWith('image/') || !ext) return NextResponse.json({ error: 'Tipo não suportado' }, { status: 415 })

  const admin = createAdminClient()
  const path = `${user.id}.${ext}`
  const bucket = admin.storage.from('avatars')
  const { data, error } = await bucket.createSignedUploadUrl(path)  // upsert no PUT
  if (error || !data) return NextResponse.json({ error: 'Falha ao preparar upload' }, { status: 500 })
  const { data: pub } = bucket.getPublicUrl(path)

  // Grava a URL pública já (o PUT subsequente coloca os bytes no mesmo path)
  await admin.from('profiles').update({ avatar_url: pub.publicUrl } as never).eq('id', user.id)

  return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, path: data.path, publicUrl: pub.publicUrl }, { status: 200 })
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/profile/avatar/
git commit -m "feat(social): URL assinada de upload de avatar"
```

---

## Task 6: `POST`/`DELETE /api/follow` + `POST /api/follow/approve`

**Files:**
- Create: `src/app/api/follow/route.ts`, `src/app/api/follow/route.test.ts`, `src/app/api/follow/approve/route.ts`, `src/app/api/follow/approve/route.test.ts`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`.
- Produces:
  - `POST /api/follow { followeeId }` → cria follow; se perfil do followee é privado → `status:'pending'`, senão `'accepted'`. Retorna `{ status }`. 400 se followee = self.
  - `DELETE /api/follow { followeeId }` → remove (deixar de seguir / cancelar solicitação). `{ ok: true }`.
  - `POST /api/follow/approve { followerId, accept }` → o dono (followee = caller) aprova (`accepted`) ou recusa (deleta). `{ ok: true }`.

- [ ] **Step 1: Testes (falhando) — follow**

```ts
// src/app/api/follow/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockProfileSelect, mockUpsert, mockDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(), mockProfileSelect: vi.fn(), mockUpsert: vi.fn(), mockDelete: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation((t: string) => t === 'profiles'
      ? { select: mockProfileSelect }
      : { upsert: mockUpsert, delete: mockDelete }),
  }),
}))
import { NextRequest } from 'next/server'
import { POST, DELETE } from './route'
const req = (m: string, b: unknown) => new NextRequest('http://localhost/api/follow', { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null })
  mockProfileSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { is_private: false }, error: null }) })
  mockUpsert.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis(), then: undefined })
})

describe('POST /api/follow', () => {
  it('400 seguir a si mesmo', async () => {
    expect((await POST(req('POST', { followeeId: 'me' }))).status).toBe(400)
  })
  it('accepted quando perfil público', async () => {
    const res = await POST(req('POST', { followeeId: 'other' }))
    expect(res.status).toBe(200); expect((await res.json()).status).toBe('accepted')
  })
  it('pending quando perfil privado', async () => {
    mockProfileSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { is_private: true }, error: null }) })
    const res = await POST(req('POST', { followeeId: 'other' }))
    expect((await res.json()).status).toBe('pending')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar follow**

```ts
// src/app/api/follow/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function caller(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await caller(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { followeeId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const followeeId = typeof body.followeeId === 'string' ? body.followeeId : ''
  if (!followeeId || followeeId === user.id) return NextResponse.json({ error: 'Invalid followee' }, { status: 400 })

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('is_private').eq('id', followeeId).single()
  const isPrivate = (prof as { is_private?: boolean } | null)?.is_private === true
  const status = isPrivate ? 'pending' : 'accepted'
  const { error } = await admin.from('follows').upsert(
    { follower_id: user.id, followee_id: followeeId, status } as never,
    { onConflict: 'follower_id,followee_id' } as never,
  )
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ status }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const user = await caller(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { followeeId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const followeeId = typeof body.followeeId === 'string' ? body.followeeId : ''
  if (!followeeId) return NextResponse.json({ error: 'Invalid followee' }, { status: 400 })
  const admin = createAdminClient()
  await admin.from('follows').delete().eq('follower_id', user.id).eq('followee_id', followeeId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 4: Testes approve (falhando)**

```ts
// src/app/api/follow/approve/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUpdate, mockDelete } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpdate: vi.fn(), mockDelete: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate, delete: mockDelete }) }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/follow/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockReturnThis() })
  mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() })
})
describe('POST /api/follow/approve', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(req({ followerId: 'x', accept: true }))).status).toBe(401)
  })
  it('200 aceitar', async () => { expect((await POST(req({ followerId: 'x', accept: true }))).status).toBe(200) })
  it('200 recusar', async () => { expect((await POST(req({ followerId: 'x', accept: false }))).status).toBe(200) })
})
```

- [ ] **Step 5: Implementar approve**

```ts
// src/app/api/follow/approve/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { followerId?: unknown; accept?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const followerId = typeof body.followerId === 'string' ? body.followerId : ''
  if (!followerId) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const admin = createAdminClient()
  // o caller É o followee (dono do perfil); escopo garante que só aprova solicitações a si
  if (body.accept === true) {
    await admin.from('follows').update({ status: 'accepted' } as never)
      .eq('follower_id', followerId).eq('followee_id', user.id)
  } else {
    await admin.from('follows').delete().eq('follower_id', followerId).eq('followee_id', user.id)
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 6: Rodar os dois testes** → PASS.

Run: `npx vitest run src/app/api/follow/`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/follow/
git commit -m "feat(social): seguir/deixar de seguir + aprovar solicitação"
```

---

## Task 7: `POST /api/posts` — publicar card ou texto

**Files:**
- Create: `src/app/api/posts/route.ts`, `src/app/api/posts/route.test.ts`

**Interfaces:**
- Consumes: `createClient`.
- Produces: `POST { kind, consultationId?, rankingSnapshot?, body? }` → `{ id }` 201. Valida invariante (card exige consultationId OU rankingSnapshot; text exige body). Para `kind='card'` com `consultationId`, confere que a consulta é do caller e está `finished` (402/403 senão). Escreve com o client do usuário (`createClient`) — RLS `posts_insert` garante autoria.

- [ ] **Step 1: Testes (falhando)**

```ts
// src/app/api/posts/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockConsultSelect, mockInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockConsultSelect: vi.fn(), mockInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((t: string) => t === 'consultations' ? { select: mockConsultSelect } : { insert: mockInsert }),
  }),
}))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockConsultSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'c1', status: 'finished' }, error: null }) })
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'post1' }, error: null }) }) })
})
describe('POST /api/posts', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ kind: 'text', body: 'x' }))).status).toBe(401) })
  it('422 card sem referência', async () => { expect((await POST(req({ kind: 'card' }))).status).toBe(422) })
  it('422 text sem body', async () => { expect((await POST(req({ kind: 'text', body: '   ' }))).status).toBe(422) })
  it('403 card de consulta que não é do usuário ou não finalizada', async () => {
    mockConsultSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await POST(req({ kind: 'card', consultationId: 'c1' }))).status).toBe(403)
  })
  it('201 card de consulta finalizada', async () => {
    const res = await POST(req({ kind: 'card', consultationId: 'c1', body: 'mandei bem' }))
    expect(res.status).toBe(201); expect((await res.json()).id).toBe('post1')
  })
  it('201 text', async () => { expect((await POST(req({ kind: 'text', body: 'dúvida sobre ICC' }))).status).toBe(201) })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/app/api/posts/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; consultationId?: unknown; rankingSnapshot?: unknown; body?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const kind = body.kind === 'card' || body.kind === 'text' ? body.kind : null
  if (!kind) return NextResponse.json({ error: 'kind inválido' }, { status: 422 })
  const caption = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : ''
  const consultationId = typeof body.consultationId === 'string' ? body.consultationId : null
  const rankingSnapshot = body.rankingSnapshot && typeof body.rankingSnapshot === 'object' ? body.rankingSnapshot : null

  if (kind === 'text' && !caption) return NextResponse.json({ error: 'Texto vazio' }, { status: 422 })
  if (kind === 'card' && !consultationId && !rankingSnapshot) return NextResponse.json({ error: 'Card sem referência' }, { status: 422 })

  if (kind === 'card' && consultationId) {
    const { data: c } = await supabase.from('consultations').select('id, status').eq('id', consultationId).eq('user_id', user.id).single()
    const row = c as { id?: string; status?: string } | null
    if (!row?.id || row.status !== 'finished') return NextResponse.json({ error: 'Consulta inválida' }, { status: 403 })
  }

  const insertRow = {
    author_id: user.id,
    kind,
    consultation_id: kind === 'card' ? consultationId : null,
    ranking_snapshot: kind === 'card' ? rankingSnapshot : null,
    body: caption || null,
  }
  const { data, error } = await supabase.from('posts').insert(insertRow as never).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Falha ao publicar' }, { status: 500 })
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/posts/route.ts src/app/api/posts/route.test.ts
git commit -m "feat(social): POST /api/posts (card de consulta/ranking ou texto)"
```

---

## Task 8: `POST`/`DELETE /api/posts/[id]/like`

**Files:**
- Create: `src/app/api/posts/[id]/like/route.ts`, `.../route.test.ts`

**Interfaces:**
- Consumes: `createClient`.
- Produces: `POST` curte (upsert idempotente), `DELETE` descurte. `{ ok: true }`. RLS garante que só curte post visível.

- [ ] **Step 1: Testes (falhando)**

```ts
// src/app/api/posts/[id]/like/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUpsert, mockDelete } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpsert: vi.fn(), mockDelete: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ upsert: mockUpsert, delete: mockDelete }) }) }))
import { NextRequest } from 'next/server'
import { POST, DELETE } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const r = (m: string) => new NextRequest('http://localhost/api/posts/p1/like', { method: m })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockUpsert.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() })
})
describe('like', () => {
  it('401 POST sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(r('POST'), ctx('p1'))).status).toBe(401) })
  it('200 curtir', async () => { expect((await POST(r('POST'), ctx('p1'))).status).toBe(200) })
  it('403 se RLS barra (upsert error)', async () => { mockUpsert.mockResolvedValue({ error: { code: '42501' } }); expect((await POST(r('POST'), ctx('p1'))).status).toBe(403) })
  it('200 descurtir', async () => { expect((await DELETE(r('DELETE'), ctx('p1'))).status).toBe(200) })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/app/api/posts/[id]/like/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabase.from('post_reactions').upsert({ post_id: id, user_id: user.id } as never, { onConflict: 'post_id,user_id' } as never)
  if (error) return NextResponse.json({ error: 'Não foi possível curtir' }, { status: 403 })
  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await supabase.from('post_reactions').delete().eq('post_id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/posts/[id]/like/"
git commit -m "feat(social): curtir/descurtir post"
```

---

## Task 9: `POST /api/posts/[id]/comments`

**Files:**
- Create: `src/app/api/posts/[id]/comments/route.ts`, `.../route.test.ts`

**Interfaces:**
- Consumes: `createClient`.
- Produces: `POST { body }` → `{ id }` 201. 422 body vazio. RLS garante comentar só em post visível (erro → 403).

- [ ] **Step 1: Testes (falhando)**

```ts
// src/app/api/posts/[id]/comments/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ insert: mockInsert }) }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (b: unknown) => new NextRequest('http://localhost/api/posts/p1/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'cm1' }, error: null }) }) })
})
describe('comments', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ body: 'oi' }), ctx('p1'))).status).toBe(401) })
  it('422 vazio', async () => { expect((await POST(req({ body: '  ' }), ctx('p1'))).status).toBe(422) })
  it('201 comenta', async () => { const res = await POST(req({ body: 'boa conduta' }), ctx('p1')); expect(res.status).toBe(201); expect((await res.json()).id).toBe('cm1') })
  it('403 se RLS barra', async () => { mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) }) }); expect((await POST(req({ body: 'x' }), ctx('p1'))).status).toBe(403) })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/app/api/posts/[id]/comments/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { body?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : ''
  if (!text) return NextResponse.json({ error: 'Comentário vazio' }, { status: 422 })
  const { data, error } = await supabase.from('comments').insert({ post_id: id, author_id: user.id, body: text } as never).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Não foi possível comentar' }, { status: 403 })
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/posts/[id]/comments/"
git commit -m "feat(social): comentar em post"
```

---

## Task 10: `POST /api/reports` + `POST`/`DELETE /api/blocks`

**Files:**
- Create: `src/app/api/reports/route.ts`, `.../route.test.ts`, `src/app/api/blocks/route.ts`, `.../route.test.ts`

**Interfaces:**
- Consumes: `createClient`.
- Produces:
  - `POST /api/reports { targetType, targetId, reason? }` → `{ ok: true }` 201. `targetType ∈ {post,comment}`.
  - `POST /api/blocks { blockedId }` / `DELETE { blockedId }` → `{ ok: true }`. 400 se self.

- [ ] **Step 1: Testes reports (falhando)**

```ts
// src/app/api/reports/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ insert: mockInsert }) }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }); mockInsert.mockResolvedValue({ error: null }) })
describe('POST /api/reports', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ targetType: 'post', targetId: 'p1' }))).status).toBe(401) })
  it('422 targetType inválido', async () => { expect((await POST(req({ targetType: 'user', targetId: 'p1' }))).status).toBe(422) })
  it('201 denuncia post', async () => { expect((await POST(req({ targetType: 'post', targetId: 'p1', reason: 'spam' }))).status).toBe(201) })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar reports**

```ts
// src/app/api/reports/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { targetType?: unknown; targetId?: unknown; reason?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const targetType = body.targetType === 'post' || body.targetType === 'comment' ? body.targetType : null
  const targetId = typeof body.targetId === 'string' ? body.targetId : ''
  if (!targetType || !targetId) return NextResponse.json({ error: 'Alvo inválido' }, { status: 422 })
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null
  const { error } = await supabase.from('reports').insert({ target_type: targetType, target_id: targetId, reporter_id: user.id, reason } as never)
  if (error) return NextResponse.json({ error: 'Falha ao denunciar' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 4: Testes blocks (falhando)**

```ts
// src/app/api/blocks/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUpsert, mockDelete } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpsert: vi.fn(), mockDelete: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ upsert: mockUpsert, delete: mockDelete }) }) }))
import { NextRequest } from 'next/server'
import { POST, DELETE } from './route'
const req = (m: string, b: unknown) => new NextRequest('http://localhost/api/blocks', { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null }); mockUpsert.mockResolvedValue({ error: null }); mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() }) })
describe('blocks', () => {
  it('400 bloquear a si', async () => { expect((await POST(req('POST', { blockedId: 'me' }))).status).toBe(400) })
  it('200 bloquear', async () => { expect((await POST(req('POST', { blockedId: 'x' }))).status).toBe(200) })
  it('200 desbloquear', async () => { expect((await DELETE(req('DELETE', { blockedId: 'x' }))).status).toBe(200) })
})
```

- [ ] **Step 5: Implementar blocks**

```ts
// src/app/api/blocks/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function who(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await who(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { blockedId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const blockedId = typeof body.blockedId === 'string' ? body.blockedId : ''
  if (!blockedId || blockedId === user.id) return NextResponse.json({ error: 'Alvo inválido' }, { status: 400 })
  const { error } = await supabase.from('blocks').upsert({ blocker_id: user.id, blocked_id: blockedId } as never, { onConflict: 'blocker_id,blocked_id' } as never)
  if (error) return NextResponse.json({ error: 'Falha' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await who(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { blockedId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const blockedId = typeof body.blockedId === 'string' ? body.blockedId : ''
  if (!blockedId) return NextResponse.json({ error: 'Alvo inválido' }, { status: 400 })
  await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 6: Rodar ambos** → PASS.

Run: `npx vitest run src/app/api/reports/ src/app/api/blocks/`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/reports/ src/app/api/blocks/
git commit -m "feat(social): denunciar conteúdo e bloquear usuário"
```

---

## Task 11: Lib de feed + rotas em `routes.ts`

**Files:**
- Create: `src/lib/social/feed.ts`, `src/lib/social/feed.test.ts`
- Modify: `src/lib/routes.ts`

**Interfaces:**
- Consumes: `canSeePost` (Task 3), `displayIdentity` (Task 2).
- Produces:
  - `type FeedPost = { id: string; author: { id: string; handle: string|null; name: string; initials: string; avatarUrl: string|null }; kind: 'card'|'text'; consultationId: string|null; rankingSnapshot: unknown; body: string|null; createdAt: string; likeCount: number; commentCount: number; likedByMe: boolean }`
  - `buildFeedPosts(rows, profilesById, viewerId): FeedPost[]` — função pura que monta os FeedPost a partir das linhas já buscadas (ordenadas desc), aplicando `displayIdentity`. (A query em si — posts de quem segue + próprios — fica na página, com RLS filtrando o resto.)
  - rotas: `FEED_ROUTE`, `profileRoute(handle)`, `postRoute(id)`, `EDIT_PROFILE_ROUTE`, `REQUESTS_ROUTE`, `RESULTS_ROUTE`.

- [ ] **Step 1: Testes (falhando)**

```ts
// src/lib/social/feed.test.ts
import { describe, it, expect } from 'vitest'
import { buildFeedPosts } from './feed'

const prof = { id: 'a', identity_mode: 'real' as const, handle: 'ana', display_name: 'Ana Silva', avatar_url: null, leaderboard_alias: null, full_name: null, is_private: false, bio: null }

describe('buildFeedPosts', () => {
  it('monta FeedPost com identidade e contadores', () => {
    const rows = [{ id: 'p1', author_id: 'a', kind: 'card', consultation_id: 'c1', ranking_snapshot: null, body: 'mandei bem', created_at: '2026-10-06T10:00:00Z', like_count: 3, comment_count: 1, liked_by_me: true }]
    const out = buildFeedPosts(rows, new Map([['a', prof]]), 'me')
    expect(out[0]).toMatchObject({ id: 'p1', kind: 'card', consultationId: 'c1', likeCount: 3, commentCount: 1, likedByMe: true })
    expect(out[0].author).toMatchObject({ handle: 'ana', name: 'Ana Silva' })
  })
  it('autor desconhecido vira "Aluno" sem quebrar', () => {
    const rows = [{ id: 'p2', author_id: 'zzz', kind: 'text', consultation_id: null, ranking_snapshot: null, body: 'dúvida', created_at: '2026-10-06T10:00:00Z', like_count: 0, comment_count: 0, liked_by_me: false }]
    const out = buildFeedPosts(rows, new Map(), 'me')
    expect(out[0].author.name).toBe('Aluno')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar feed.ts**

```ts
// src/lib/social/feed.ts
import { displayIdentity } from './identity'
import type { ProfileSocial } from './types'

export type FeedPost = {
  id: string
  author: { id: string; handle: string | null; name: string; initials: string; avatarUrl: string | null }
  kind: 'card' | 'text'
  consultationId: string | null
  rankingSnapshot: unknown
  body: string | null
  createdAt: string
  likeCount: number
  commentCount: number
  likedByMe: boolean
}

type Row = {
  id: string; author_id: string; kind: 'card' | 'text'
  consultation_id: string | null; ranking_snapshot: unknown; body: string | null
  created_at: string; like_count: number; comment_count: number; liked_by_me: boolean
}

export function buildFeedPosts(rows: Row[], profilesById: Map<string, ProfileSocial>, _viewerId: string): FeedPost[] {
  return rows.map(r => {
    const p = profilesById.get(r.author_id)
    const id = p
      ? displayIdentity(p)
      : { name: 'Aluno', avatarUrl: null, initials: 'A' }
    return {
      id: r.id,
      author: { id: r.author_id, handle: p?.handle ?? null, name: id.name, initials: id.initials, avatarUrl: id.avatarUrl },
      kind: r.kind,
      consultationId: r.consultation_id,
      rankingSnapshot: r.ranking_snapshot,
      body: r.body,
      createdAt: r.created_at,
      likeCount: r.like_count ?? 0,
      commentCount: r.comment_count ?? 0,
      likedByMe: !!r.liked_by_me,
    }
  })
}
```

- [ ] **Step 4: Adicionar rotas**

```ts
// src/lib/routes.ts — acrescentar
export const FEED_ROUTE            = '/feed'
export const EDIT_PROFILE_ROUTE    = '/perfil/editar'
export const REQUESTS_ROUTE        = '/solicitacoes'
export const RESULTS_ROUTE         = '/resultados'

export const profileRoute          = (handle: string) => `/u/${handle}`
export const postRoute             = (id: string) => `/post/${id}`
```

- [ ] **Step 5: Rodar e ver passar** → PASS.

Run: `npx vitest run src/lib/social/feed.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/social/feed.ts src/lib/social/feed.test.ts src/lib/routes.ts
git commit -m "feat(social): lib pura de montagem de feed + rotas"
```

---

## Task 12: Página `/feed` + `PostCard` + publicar do fim-da-consulta reutilizando o existente

**Files:**
- Create: `src/app/(dashboard)/feed/page.tsx`, `src/app/(dashboard)/feed/FeedList.tsx`, `src/app/(dashboard)/feed/PostCard.tsx`
- Modify: `src/components/layout/Shell.tsx` (link "Feed" + avatar → `/perfil/editar`)

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `buildFeedPosts`, `FEED_ROUTE`, `postRoute`, `profileRoute`, `shareCardRoute` (já existe).
- Produces: feed renderizado (server) + interações (client).

- [ ] **Step 1: Página server component**

```tsx
// src/app/(dashboard)/feed/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { buildFeedPosts } from '@/lib/social/feed'
import type { ProfileSocial } from '@/lib/social/types'
import { FeedList } from './FeedList'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  // RLS (posts_select) já filtra visibilidade; buscamos os posts visíveis mais recentes
  // com o client do usuário (a policy aplica autoria/privacidade/bloqueio).
  const { data: rawPosts } = await supabase
    .from('posts').select('*').order('created_at', { ascending: false }).limit(30)
  const posts = (rawPosts ?? []) as Array<{ id: string; author_id: string; kind: 'card'|'text'; consultation_id: string|null; ranking_snapshot: unknown; body: string|null; created_at: string }>

  const admin = createAdminClient()
  const authorIds = [...new Set(posts.map(p => p.author_id))]
  const ids = posts.map(p => p.id)

  const [{ data: profs }, { data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
    admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name').in('id', authorIds.length ? authorIds : ['_']),
    admin.from('post_reactions').select('post_id').in('post_id', ids.length ? ids : ['_']),
    supabase.from('post_reactions').select('post_id').eq('user_id', user.id).in('post_id', ids.length ? ids : ['_']),
    admin.from('comments').select('post_id').is('hidden_at', null).in('post_id', ids.length ? ids : ['_']),
  ])

  const count = (rows: Array<{ post_id: string }> | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1)
    return m
  }
  const likeMap = count(likes as Array<{ post_id: string }> | null)
  const commentMap = count(comments as Array<{ post_id: string }> | null)
  const mine = new Set((myLikes as Array<{ post_id: string }> | null ?? []).map(r => r.post_id))

  const profilesById = new Map<string, ProfileSocial>((profs as ProfileSocial[] ?? []).map(p => [p.id, p]))
  const rows = posts.map(p => ({
    ...p,
    like_count: likeMap.get(p.id) ?? 0,
    comment_count: commentMap.get(p.id) ?? 0,
    liked_by_me: mine.has(p.id),
  }))
  const feed = buildFeedPosts(rows, profilesById, user.id)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Feed</h1>
      <FeedList posts={feed} />
    </div>
  )
}
```

- [ ] **Step 2: `FeedList` + `PostCard` (client)**

```tsx
// src/app/(dashboard)/feed/FeedList.tsx
'use client'
import type { FeedPost } from '@/lib/social/feed'
import { PostCard } from './PostCard'

export function FeedList({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">Seu feed está vazio. Siga colegas ou publique um resultado em "Meus resultados".</p>
  }
  return <div className="space-y-4">{posts.map(p => <PostCard key={p.id} post={p} />)}</div>
}
```

```tsx
// src/app/(dashboard)/feed/PostCard.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { postRoute, profileRoute, shareCardRoute } from '@/lib/routes'
import type { FeedPost } from '@/lib/social/feed'

export function PostCard({ post }: { post: FeedPost }) {
  const router = useRouter()
  const [liked, setLiked] = useState(post.likedByMe)
  const [count, setCount] = useState(post.likeCount)
  const [busy, setBusy] = useState(false)

  async function toggleLike() {
    if (busy) return
    setBusy(true)
    const next = !liked
    setLiked(next); setCount(c => c + (next ? 1 : -1))
    try {
      await fetch(`/api/posts/${post.id}/like`, { method: next ? 'POST' : 'DELETE' })
    } catch {
      setLiked(!next); setCount(c => c + (next ? -1 : 1))
    } finally { setBusy(false) }
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-3">
        <Link href={post.author.handle ? profileRoute(post.author.handle) : '#'} className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-bold text-ink">
            {post.author.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" />
              : post.author.initials}
          </span>
          <span className="text-sm font-semibold text-ink">{post.author.name}</span>
        </Link>
      </header>

      {post.kind === 'card' && post.consultationId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shareCardRoute(post.consultationId)} alt="Card do resultado" className="mb-3 w-full rounded-lg border border-border" />
      )}
      {post.body && <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{post.body}</p>}

      <footer className="flex items-center gap-4 text-sm">
        <button onClick={toggleLike} disabled={busy} className={`font-medium ${liked ? 'text-primary' : 'text-muted hover:text-ink'}`}>
          ♥ {count}
        </button>
        <button onClick={() => router.push(postRoute(post.id))} className="font-medium text-muted hover:text-ink">
          💬 {post.commentCount}
        </button>
      </footer>
    </article>
  )
}
```

- [ ] **Step 3: Link no Shell**

Modificar `src/components/layout/Shell.tsx`: adicionar, antes do link "Ranking", `<Link href="/feed" className="text-xs font-medium text-muted transition-colors hover:text-primary">Feed</Link>`.

- [ ] **Step 4: Verificação manual (build + visual)**

Run: `npx tsc --noEmit && npx next build` → sem erros. (Teste visual acontece após deploy; o feed vazio deve mostrar o estado vazio.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/feed/" src/components/layout/Shell.tsx
git commit -m "feat(social): página de feed com card-posts, curtir e atalho de comentários"
```

---

## Task 13: Página de perfil `/u/[handle]` + `FollowButton` + bloquear

**Files:**
- Create: `src/app/(dashboard)/u/[handle]/page.tsx`, `.../FollowButton.tsx`, `.../ProfileActions.tsx`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `displayIdentity`, `profileRoute`, `shareCardRoute`.
- Produces: perfil com identidade, bio, contadores, botão seguir e menu bloquear; grade de posts (reusa `PostCard`? posts do perfil são só os visíveis — simplificar: lista os próprios posts do autor que o viewer pode ver — a RLS filtra).

- [ ] **Step 1: Página**

```tsx
// src/app/(dashboard)/u/[handle]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { FollowButton } from './FollowButton'
import { ProfileActions } from './ProfileActions'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles')
    .select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name')
    .eq('handle', handle).single()
  const profile = prof as ProfileSocial | null
  if (!profile) notFound()

  const id = displayIdentity(profile)
  const isSelf = profile.id === user.id

  const [{ count: followers }, { count: following }, { data: myFollow }] = await Promise.all([
    admin.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', profile.id).eq('status', 'accepted'),
    admin.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id).eq('status', 'accepted'),
    admin.from('follows').select('status').eq('follower_id', user.id).eq('followee_id', profile.id).maybeSingle(),
  ])
  const followState = (myFollow as { status?: string } | null)?.status ?? 'none'

  // posts visíveis do autor (RLS filtra para o viewer)
  const { data: posts } = await supabase.from('posts').select('id, kind, consultation_id, body, created_at').eq('author_id', profile.id).order('created_at', { ascending: false }).limit(30)

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-surface-2 text-2xl font-bold text-ink">
          {id.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={id.avatarUrl} alt="" className="h-full w-full object-cover" /> : id.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-ink">{id.name}</h1>
          {profile.handle && <p className="text-sm text-muted">@{profile.handle}</p>}
          {profile.bio && <p className="mt-1 text-sm text-ink">{profile.bio}</p>}
          <p className="mt-1 text-xs text-muted tabular-nums">{followers ?? 0} seguidores · {following ?? 0} seguindo</p>
        </div>
        {!isSelf && (
          <div className="flex items-center gap-2">
            <FollowButton followeeId={profile.id} initialState={followState as 'none'|'pending'|'accepted'} isPrivate={profile.is_private} />
            <ProfileActions blockedId={profile.id} />
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(posts ?? []).map((p: { id: string; kind: string; consultation_id: string|null }) => (
          <a key={p.id} href={`/post/${p.id}`} className="block aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
            {p.kind === 'card' && p.consultation_id
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/share/${p.consultation_id}`} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center p-2 text-center text-xs text-muted">texto</span>}
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `FollowButton` (client)**

```tsx
// src/app/(dashboard)/u/[handle]/FollowButton.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FollowButton({ followeeId, initialState, isPrivate }: { followeeId: string; initialState: 'none'|'pending'|'accepted'; isPrivate: boolean }) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)

  async function act() {
    if (busy) return
    setBusy(true)
    try {
      if (state === 'none') {
        const res = await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followeeId }) })
        const j = await res.json(); if (res.ok) setState(j.status)
      } else {
        await fetch('/api/follow', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followeeId }) })
        setState('none')
      }
      router.refresh()
    } finally { setBusy(false) }
  }

  const label = state === 'accepted' ? 'Seguindo' : state === 'pending' ? 'Solicitado' : (isPrivate ? 'Solicitar' : 'Seguir')
  return (
    <button onClick={act} disabled={busy} className={`rounded-md px-4 py-1.5 text-xs font-semibold ${state === 'none' ? 'bg-primary text-primary-ink' : 'border border-border bg-surface-2 text-ink'}`}>
      {label}
    </button>
  )
}
```

- [ ] **Step 3: `ProfileActions` (bloquear, client)**

```tsx
// src/app/(dashboard)/u/[handle]/ProfileActions.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ProfileActions({ blockedId }: { blockedId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function block() {
    if (busy) return
    setBusy(true)
    try { await fetch('/api/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blockedId }) }); router.refresh() }
    finally { setBusy(false) }
  }
  return <button onClick={block} disabled={busy} title="Bloquear" className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-muted hover:text-danger">⋯</button>
}
```

- [ ] **Step 4: Verificação (build)**

Run: `npx tsc --noEmit && npx next build` → sem erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/u/"
git commit -m "feat(social): página de perfil com seguir e bloquear"
```

---

## Task 14: Página do post `/post/[id]` + comentários + curtir + denunciar

**Files:**
- Create: `src/app/(dashboard)/post/[id]/page.tsx`, `.../CommentComposer.tsx`, `.../ReportMenu.tsx`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `displayIdentity`, `shareCardRoute`.
- Produces: detalhe do post + thread de comentários + compositor + denunciar.

- [ ] **Step 1: Página**

```tsx
// src/app/(dashboard)/post/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { displayIdentity } from '@/lib/social/identity'
import { shareCardRoute } from '@/lib/routes'
import type { ProfileSocial } from '@/lib/social/types'
import { CommentComposer } from './CommentComposer'
import { ReportMenu } from './ReportMenu'

export const dynamic = 'force-dynamic'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  // RLS garante que só carrega se visível
  const { data: post } = await supabase.from('posts').select('*').eq('id', id).single()
  const p = post as { id: string; author_id: string; kind: 'card'|'text'; consultation_id: string|null; body: string|null } | null
  if (!p) notFound()

  const admin = createAdminClient()
  const { data: authorRow } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name').eq('id', p.author_id).single()
  const authorId = displayIdentity(authorRow as ProfileSocial)

  const { data: rawComments } = await supabase.from('comments').select('id, author_id, body, created_at').eq('post_id', id).is('hidden_at', null).order('created_at', { ascending: true })
  const comments = (rawComments ?? []) as Array<{ id: string; author_id: string; body: string; created_at: string }>
  const commenterIds = [...new Set(comments.map(c => c.author_id))]
  const { data: commenters } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', commenterIds.length ? commenterIds : ['_'])
  const byId = new Map((commenters as ProfileSocial[] ?? []).map(c => [c.id, c]))

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <article className="rounded-xl border border-border bg-surface p-4">
        <header className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{authorId.name}</span>
          <ReportMenu targetType="post" targetId={p.id} />
        </header>
        {p.kind === 'card' && p.consultation_id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shareCardRoute(p.consultation_id)} alt="" className="mb-3 w-full rounded-lg border border-border" />
        )}
        {p.body && <p className="whitespace-pre-wrap text-sm text-ink">{p.body}</p>}
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Comentários</h2>
        {comments.map(c => {
          const idc = byId.get(c.author_id)
          const name = idc ? displayIdentity(idc).name : 'Aluno'
          return (
            <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{name}</span>
                <ReportMenu targetType="comment" targetId={c.id} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
            </div>
          )
        })}
        <CommentComposer postId={p.id} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: `CommentComposer` (client)**

```tsx
// src/app/(dashboard)/post/[id]/CommentComposer.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CommentComposer({ postId }: { postId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function send() {
    if (busy || !text.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      if (res.ok) { setText(''); router.refresh() }
    } finally { setBusy(false) }
  }
  return (
    <div className="flex gap-2">
      <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder="Comentar…" className="flex-1 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      <button onClick={send} disabled={busy || !text.trim()} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-ink disabled:opacity-50">Enviar</button>
    </div>
  )
}
```

- [ ] **Step 3: `ReportMenu` (client)**

```tsx
// src/app/(dashboard)/post/[id]/ReportMenu.tsx
'use client'
import { useState } from 'react'

export function ReportMenu({ targetType, targetId }: { targetType: 'post'|'comment'; targetId: string }) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function report() {
    if (busy || done) return
    setBusy(true)
    try {
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, targetId, reason: 'denúncia do usuário' }) })
      if (res.ok) setDone(true)
    } finally { setBusy(false) }
  }
  return <button onClick={report} disabled={busy || done} title="Denunciar" className="text-xs text-muted hover:text-danger">{done ? 'denunciado' : '⚑'}</button>
}
```

- [ ] **Step 4: Verificação (build)**

Run: `npx tsc --noEmit && npx next build` → sem erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/post/"
git commit -m "feat(social): página do post com comentários, denunciar"
```

---

## Task 15: Editar perfil `/perfil/editar` + upload de avatar

**Files:**
- Create: `src/app/(dashboard)/perfil/editar/page.tsx`, `.../EditProfileForm.tsx`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `suggestHandle`, APIs `/api/profile` e `/api/profile/avatar`.
- Produces: formulário de identidade/handle/bio/privacidade + upload de foto.

- [ ] **Step 1: Página (carrega o perfil atual)**

```tsx
// src/app/(dashboard)/perfil/editar/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { suggestHandle } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { EditProfileForm } from './EditProfileForm'

export const dynamic = 'force-dynamic'

export default async function EditProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name').eq('id', user.id).single()
  const p = data as ProfileSocial
  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink">Editar perfil</h1>
      <EditProfileForm
        initial={{
          identity_mode: p.identity_mode, handle: p.handle ?? suggestHandle(user.email ?? 'aluno@medmind'),
          display_name: p.display_name ?? '', bio: p.bio ?? '', is_private: p.is_private, avatar_url: p.avatar_url,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: `EditProfileForm` (client)**

```tsx
// src/app/(dashboard)/perfil/editar/EditProfileForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Init = { identity_mode: 'real'|'alias'; handle: string; display_name: string; bio: string; is_private: boolean; avatar_url: string|null }

export function EditProfileForm({ initial }: { initial: Init }) {
  const router = useRouter()
  const [f, setF] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function uploadAvatar(file: File) {
    const res = await fetch('/api/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) })
    if (!res.ok) { setMsg('Falha ao preparar upload da foto.'); return }
    const { uploadUrl, publicUrl } = await res.json()
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    if (!put.ok) { setMsg('Falha ao enviar a foto.'); return }
    setF(s => ({ ...s, avatar_url: publicUrl }))
  }

  async function save() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity_mode: f.identity_mode, handle: f.handle, display_name: f.display_name, bio: f.bio, is_private: f.is_private }) })
      if (res.status === 409) { setMsg('Esse @handle já está em uso.'); return }
      if (res.status === 422) { setMsg('Handle inválido (3-30, só letras minúsculas, números, _ e .).'); return }
      if (!res.ok) { setMsg('Não foi possível salvar.'); return }
      setMsg('Perfil salvo.'); router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['alias','real'] as const).map(m => (
          <button key={m} onClick={() => setF(s => ({ ...s, identity_mode: m }))} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${f.identity_mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}>
            {m === 'alias' ? 'Apelido (privado)' : 'Nome + foto'}
          </button>
        ))}
      </div>

      {f.identity_mode === 'real' && (
        <>
          <label className="block">
            <span className="text-xs font-medium text-muted">Nome exibido</span>
            <input value={f.display_name} onChange={e => setF(s => ({ ...s, display_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Foto</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadAvatar(file) }} className="mt-1 block w-full text-xs text-muted" />
            {f.avatar_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.avatar_url} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />}
          </label>
        </>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted">@handle (link do seu perfil)</span>
        <input value={f.handle} onChange={e => setF(s => ({ ...s, handle: e.target.value.toLowerCase() }))} maxLength={30} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted">Bio</span>
        <textarea value={f.bio} onChange={e => setF(s => ({ ...s, bio: e.target.value }))} maxLength={280} rows={3} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      </label>
      <label className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <span className="text-sm text-ink">Perfil privado (aprovo quem me segue)</span>
        <input type="checkbox" checked={f.is_private} onChange={e => setF(s => ({ ...s, is_private: e.target.checked }))} />
      </label>

      <button onClick={save} disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Avatar no Shell → `/perfil/editar`**

Modificar `src/components/layout/Shell.tsx`: adicionar, ao lado dos links, um `<Link href="/perfil/editar">` com um avatar/ícone pequeno (reusa iniciais se sem foto). Mínimo: um link "Perfil".

- [ ] **Step 4: Verificação (build)**

Run: `npx tsc --noEmit && npx next build` → sem erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/perfil/" src/components/layout/Shell.tsx
git commit -m "feat(social): editar perfil (identidade, handle, bio, privacidade, foto)"
```

---

## Task 16: Solicitações `/solicitacoes` (perfil privado aprova)

**Files:**
- Create: `src/app/(dashboard)/solicitacoes/page.tsx`, `.../RequestRow.tsx`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `displayIdentity`, `/api/follow/approve`.
- Produces: lista de solicitações pendentes com aprovar/recusar.

- [ ] **Step 1: Página**

```tsx
// src/app/(dashboard)/solicitacoes/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { RequestRow } from './RequestRow'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const admin = createAdminClient()
  const { data: reqs } = await admin.from('follows').select('follower_id').eq('followee_id', user.id).eq('status', 'pending')
  const ids = (reqs as Array<{ follower_id: string }> ?? []).map(r => r.follower_id)
  const { data: profs } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', ids.length ? ids : ['_'])
  const list = (profs as ProfileSocial[] ?? []).map(p => ({ id: p.id, name: displayIdentity(p).name, handle: p.handle }))

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink">Solicitações</h1>
      {list.length === 0 ? <p className="text-sm text-muted">Nenhuma solicitação pendente.</p> : list.map(r => <RequestRow key={r.id} followerId={r.id} name={r.name} />)}
    </div>
  )
}
```

- [ ] **Step 2: `RequestRow` (client)**

```tsx
// src/app/(dashboard)/solicitacoes/RequestRow.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RequestRow({ followerId, name }: { followerId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)
  async function respond(accept: boolean) {
    if (busy) return
    setBusy(true)
    try { await fetch('/api/follow/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followerId, accept }) }); setGone(true); router.refresh() }
    finally { setBusy(false) }
  }
  if (gone) return null
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
      <span className="text-sm text-ink">{name}</span>
      <div className="flex gap-2">
        <button onClick={() => respond(true)} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink disabled:opacity-50">Aceitar</button>
        <button onClick={() => respond(false)} disabled={busy} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted disabled:opacity-50">Recusar</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificação (build)** → `npx tsc --noEmit && npx next build`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/solicitacoes/"
git commit -m "feat(social): tela de solicitações de seguir (perfil privado)"
```

---

## Task 17: Meus resultados `/resultados` → publicar quando quiser

**Files:**
- Create: `src/app/(dashboard)/resultados/page.tsx`, `.../PublishResultButton.tsx`
- Modify: `src/components/layout/Shell.tsx` (link "Meus resultados" — opcional, pode ficar no perfil)

**Interfaces:**
- Consumes: `createClient`, `shareCardRoute`, `/api/posts`.
- Produces: lista de consultas finalizadas do usuário, cada uma com o card e um botão "Publicar no feed" (resolve "sair e voltar e postar quando quiser").

- [ ] **Step 1: Página (histórico do usuário)**

```tsx
// src/app/(dashboard)/resultados/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, shareCardRoute } from '@/lib/routes'
import { PublishResultButton } from './PublishResultButton'

export const dynamic = 'force-dynamic'

export default async function ResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { data } = await supabase.from('consultations').select('id, finished_at, points').eq('user_id', user.id).eq('status', 'finished').order('finished_at', { ascending: false }).limit(50)
  const rows = (data ?? []) as Array<{ id: string; finished_at: string|null; points: number|null }>

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink">Meus resultados</h1>
      {rows.length === 0 ? <p className="text-sm text-muted">Você ainda não finalizou consultas.</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shareCardRoute(r.id)} alt="" className="mb-3 w-full rounded-lg border border-border" />
              <PublishResultButton consultationId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `PublishResultButton` (client)**

```tsx
// src/app/(dashboard)/resultados/PublishResultButton.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postRoute } from '@/lib/routes'

export function PublishResultButton({ consultationId }: { consultationId: string }) {
  const router = useRouter()
  const [caption, setCaption] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function publish() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'card', consultationId, body: caption }) })
      const j = await res.json()
      if (res.ok) { router.push(postRoute(j.id)) } else { setMsg(j.error ?? 'Falha ao publicar') }
    } finally { setBusy(false) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">Publicar no feed</button>
  return (
    <div className="space-y-2">
      <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} placeholder="Legenda (opcional)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      <button onClick={publish} disabled={busy} className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Publicando…' : 'Confirmar publicação'}</button>
      {msg && <p className="text-xs text-danger">{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Link no Shell** — adicionar "Meus resultados" (ou acessível pelo próprio perfil). Mínimo: link no header.

- [ ] **Step 4: Verificação final da fatia**

Run: `npx tsc --noEmit && npx eslint "src/app/(dashboard)/" "src/app/api/" "src/lib/social/" && npx vitest run && npx next build`
Expected: tudo verde.

- [ ] **Step 5: Commit + deploy**

```bash
git add "src/app/(dashboard)/resultados/" src/components/layout/Shell.tsx
git commit -m "feat(social): meus resultados — publicar card no feed quando quiser"
git push origin main
curl -s -o /dev/null -w "%{http_code}\n" "http://2.25.135.251:3000/api/deploy/bb8c580877a458b31ebb966072962eaa9d519d41c2a7796b"
```
Confirmar deploy por `curl https://app.medmindedu.com.br/api/version` (builtAt novo) + smoke: `/feed`→200 logado / 307 deslogado; `/u/<handle>` carrega; publicar um resultado e vê-lo no feed.

---

## Self-Review (feito pelo autor do plano)

**Cobertura da spec (Fatia 1):**
- Perfil + identidade à escolha → Tasks 2, 4, 5, 15. ✓
- Seguir (público/privado) + solicitações → Tasks 6, 13, 16. ✓
- Feed de card-posts → Tasks 11, 12. ✓
- Curtir + comentar → Tasks 8, 9, 12, 14. ✓
- Denunciar + bloquear → Tasks 10, 13, 14. ✓
- RLS + visibilidade → Task 1 (policies) + Task 3 (função espelho). ✓
- "Meus resultados" (postar quando quiser) → Task 17. ✓
- Publicar do fim da consulta: o `FinishModal` já tem o card; a publicação explícita no feed entra por "Meus resultados" (Task 17) e pode ganhar um atalho no FinishModal numa iteração — NÃO bloqueia a fatia.

**Placeholders:** nenhum TODO/TBD; todo passo tem código real.

**Consistência de tipos:** `ProfileSocial` (Task 2) é consumido igual em feed/páginas; `displayIdentity` assinatura estável; `canSeePost` (Task 3) espelha as policies da Task 1; `FeedPost` (Task 11) consumido no `PostCard` (Task 12). Rotas (`profileRoute`, `postRoute`, `shareCardRoute`) usadas como definidas.

**Notas de risco conhecidas (para o executor):**
- As colunas novas não estão nos tipos gerados → usar `as never`/casts como no restante do projeto (já refletido no código).
- Páginas não têm teste unitário (padrão do projeto) — a garantia é `tsc`+`build`+smoke pós-deploy; a lógica testável foi extraída para libs puras (identity/visibility/feed).
- `shareCardRoute` de card de ranking (snapshot) ficou fora da Fatia 1 (só card de consulta é renderizado); post de ranking-snapshot aceita no backend mas o render visual do snapshot entra quando a rota `/api/share/ranking` existir (fatia posterior).
