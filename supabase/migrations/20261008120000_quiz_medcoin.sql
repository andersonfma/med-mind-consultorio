-- Quiz + Caso da Semana + MedCoin. RLS em tudo. Casos simulados.

-- posts: novos tipos + campos (quiz, duvida, resenha)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quiz_id UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS meta JSONB;

-- Caso da semana
CREATE TABLE IF NOT EXISTS weekly_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  specialty TEXT NOT NULL DEFAULT 'Clínica Médica',
  title TEXT NOT NULL,
  true_diagnosis TEXT NOT NULL,
  overview TEXT NOT NULL,
  review TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quizzes (desafio e usuário)
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- null = sistema
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_key TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_array_length(options) BETWEEN 2 AND 5)
);

-- posts.quiz_id FK + CHECK de kind recriado
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_quiz_fk;
ALTER TABLE posts ADD CONSTRAINT posts_quiz_fk FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check CHECK (
  (kind = 'card' AND (consultation_id IS NOT NULL OR ranking_snapshot IS NOT NULL)) OR
  (kind = 'text' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'duvida' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'resenha' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'quiz' AND quiz_id IS NOT NULL)
);

-- Dias do caso
CREATE TABLE IF NOT EXISTS challenge_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_case_id UUID NOT NULL REFERENCES weekly_cases(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index BETWEEN 1 AND 5),
  reveal_date DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('anamnese','exame','complementares','conduta','conclusao')),
  narrative TEXT NOT NULL,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  UNIQUE (weekly_case_id, day_index)
);
CREATE INDEX IF NOT EXISTS challenge_days_reveal_idx ON challenge_days (reveal_date);

-- Respostas (1 tentativa)
CREATE TABLE IF NOT EXISTS quiz_answers (
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chosen_key TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  stake INT NOT NULL DEFAULT 0,
  delta INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, user_id)
);

-- Ledger de MedCoin
CREATE TABLE IF NOT EXISTS medcoin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('challenge','doubt_answer')),
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medcoin_events_user_idx ON medcoin_events (user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS medcoin_doubt_once ON medcoin_events (ref_id) WHERE source = 'doubt_answer';

-- Streak de desafio
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_streak INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_last_date DATE;

-- RLS
ALTER TABLE weekly_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medcoin_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION challenge_quiz_open(q UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM challenge_days d WHERE d.quiz_id = q AND d.reveal_date <= current_date);
$$;

DROP POLICY IF EXISTS weekly_cases_sel ON weekly_cases;
CREATE POLICY weekly_cases_sel ON weekly_cases FOR SELECT
  USING (EXISTS (SELECT 1 FROM challenge_days d WHERE d.weekly_case_id = weekly_cases.id AND d.reveal_date <= current_date));

DROP POLICY IF EXISTS challenge_days_sel ON challenge_days;
CREATE POLICY challenge_days_sel ON challenge_days FOR SELECT
  USING (reveal_date <= current_date);

DROP POLICY IF EXISTS quizzes_sel ON quizzes;
CREATE POLICY quizzes_sel ON quizzes FOR SELECT
  USING (author_id IS NOT NULL OR challenge_quiz_open(id));
DROP POLICY IF EXISTS quizzes_ins ON quizzes;
CREATE POLICY quizzes_ins ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS quiz_answers_sel ON quiz_answers;
CREATE POLICY quiz_answers_sel ON quiz_answers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS quiz_answers_ins ON quiz_answers;
CREATE POLICY quiz_answers_ins ON quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- medcoin_events: sem policy p/ authenticated => negado; service role bypassa.
