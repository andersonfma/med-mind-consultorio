-- Stories (24h). Visibilidade espelha posts (social_can_see_author); expira por expires_at.
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','card')),
  media_url TEXT,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  CHECK ((kind = 'image' AND media_url IS NOT NULL) OR (kind = 'card' AND consultation_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories (expires_at);
CREATE INDEX IF NOT EXISTS stories_author_idx ON stories (author_id, created_at DESC);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- visível: não expirado E (próprio OU autor público OU segue aceito) E sem bloqueio — reusa o helper de posts
DROP POLICY IF EXISTS stories_sel ON stories;
CREATE POLICY stories_sel ON stories FOR SELECT
  USING (expires_at > now() AND social_can_see_author(auth.uid(), author_id));
DROP POLICY IF EXISTS stories_ins ON stories;
CREATE POLICY stories_ins ON stories FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS stories_del ON stories;
CREATE POLICY stories_del ON stories FOR DELETE USING (auth.uid() = author_id);
