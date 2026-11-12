-- Mapas da Doença gerados pelo aluno (resumo centrado na fisiopatogênese).
-- Guarda o objeto estruturado (data jsonb). É a fundação da biblioteca virtual.
CREATE TABLE IF NOT EXISTS disease_maps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disease    TEXT NOT NULL,
  area       TEXT,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS disease_maps_user_created_idx
  ON disease_maps (user_id, created_at DESC);

ALTER TABLE disease_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY disease_maps_select_own ON disease_maps
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY disease_maps_insert_own ON disease_maps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY disease_maps_delete_own ON disease_maps
  FOR DELETE USING (auth.uid() = user_id);
