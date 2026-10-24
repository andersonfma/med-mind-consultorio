-- "Seja Premium": captura de interesse (sem cobrança) para medir demanda.
-- 1 linha por usuário (idempotente). Usuário vê/insere o próprio; admin (service role) conta tudo.
CREATE TABLE IF NOT EXISTS premium_interest (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE premium_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY premium_interest_ins ON premium_interest
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY premium_interest_sel ON premium_interest
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
