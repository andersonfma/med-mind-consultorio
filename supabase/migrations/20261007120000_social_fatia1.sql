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
DROP POLICY IF EXISTS follows_select ON follows;
CREATE POLICY follows_select ON follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);
DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS follows_update ON follows;
CREATE POLICY follows_update ON follows FOR UPDATE
  USING (auth.uid() = followee_id);  -- só o dono do perfil aprova
DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows FOR DELETE
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);

-- posts: visível por regra de autoria/privacidade/bloqueio; escreve só o próprio
DROP POLICY IF EXISTS posts_select ON posts;
CREATE POLICY posts_select ON posts FOR SELECT
  USING (hidden_at IS NULL AND social_can_see_author(auth.uid(), author_id));
DROP POLICY IF EXISTS posts_insert ON posts;
CREATE POLICY posts_insert ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS posts_delete ON posts;
CREATE POLICY posts_delete ON posts FOR DELETE
  USING (auth.uid() = author_id);

-- reactions: só em post visível; escreve como si
DROP POLICY IF EXISTS reactions_select ON post_reactions;
CREATE POLICY reactions_select ON post_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
DROP POLICY IF EXISTS reactions_insert ON post_reactions;
CREATE POLICY reactions_insert ON post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
DROP POLICY IF EXISTS reactions_delete ON post_reactions;
CREATE POLICY reactions_delete ON post_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- comments: ler em post visível; escrever como si em post visível
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments FOR SELECT
  USING (hidden_at IS NULL AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments FOR INSERT
  WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.hidden_at IS NULL AND social_can_see_author(auth.uid(), p.author_id)));
DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_delete ON comments FOR DELETE
  USING (auth.uid() = author_id);

-- reports: insere qualquer autenticado; SELECT só service role (sem policy de select => negado para anon/auth)
DROP POLICY IF EXISTS reports_insert ON reports;
CREATE POLICY reports_insert ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- blocks: gerencia os próprios
DROP POLICY IF EXISTS blocks_all ON blocks;
CREATE POLICY blocks_all ON blocks FOR ALL
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- Bucket de avatares (público para leitura; escrita por URL assinada emitida pelo servidor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars','avatars', true)
ON CONFLICT (id) DO NOTHING;
