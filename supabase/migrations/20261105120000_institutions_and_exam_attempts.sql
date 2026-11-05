-- Fundação do B2B + métricas de simulados.
-- 1) Instituições (faculdades/turmas) com código de convite.
-- 2) Aluno vinculado a uma instituição (profiles.institution_id).
-- 3) Gestores: usuários que administram uma instituição (veem só os alunos dela).
-- 4) exam_attempts: registro de cada simulado corrigido, p/ medir uso e desempenho.

CREATE TABLE IF NOT EXISTS institutions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS institution_managers (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (institution_id, user_id)
);

-- Simulados ENARE/ENAMED: 1 linha por simulado corrigido.
CREATE TABLE IF NOT EXISTS exam_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam       TEXT NOT NULL,   -- 'enare' | 'enamed'
  area       TEXT NOT NULL,   -- key da área
  score      INT  NOT NULL,
  total      INT  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exam_attempts_user_idx ON exam_attempts (user_id, created_at);

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_attempts_ins ON exam_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY exam_attempts_sel ON exam_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RLS das instituições: leitura liberada (nome/código são usados no fluxo de convite);
-- escrita só service role (API valida). Managers: service role gerencia.
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY institutions_sel ON institutions FOR SELECT TO authenticated USING (true);

ALTER TABLE institution_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY institution_managers_sel ON institution_managers FOR SELECT TO authenticated USING (auth.uid() = user_id);
