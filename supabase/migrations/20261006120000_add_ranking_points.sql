-- Camada social/competitiva v1 — pontos (XP) + opt-in do ranking.

-- Pontos por consulta finalizada (fonte única; o ranking soma por usuário).
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS consultations_user_finished_idx
  ON consultations(user_id, finished_at);

-- Identidade opt-in no ranking (default: anônimo).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leaderboard_optin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leaderboard_alias TEXT;
