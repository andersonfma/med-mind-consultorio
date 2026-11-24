-- Provas da turma (B2B): o coordenador formula uma prova (IA aleatória ou dirigida por
-- temas/proporções) e ela é gerada UMA vez (prova fixa, igual para todos os alunos).
-- RLS habilitada SEM policy: todo acesso passa pelo service role no servidor (como
-- institutions/spaces). Autoria/leitura são gated por institution_managers no app.

CREATE TABLE IF NOT EXISTS faculty_exams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  exam            TEXT NOT NULL DEFAULT 'enare',          -- enare | enamed
  track           TEXT NOT NULL DEFAULT 'acesso-direto',  -- acesso-direto | pre-requisito
  mode            TEXT NOT NULL,                           -- random | blueprint
  spec            JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {total} | {rows:[{area,topic,n}]}
  status          TEXT NOT NULL DEFAULT 'generating',      -- generating | ready | failed
  total_questions INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at        TIMESTAMPTZ
);
ALTER TABLE faculty_exams ENABLE ROW LEVEL SECURITY; -- sem policy: só service role
CREATE INDEX IF NOT EXISTS faculty_exams_inst_idx ON faculty_exams (institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS faculty_exam_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_exam_id UUID NOT NULL REFERENCES faculty_exams(id) ON DELETE CASCADE,
  ord             INTEGER NOT NULL,
  area            TEXT,
  topic           TEXT,
  prompt          TEXT NOT NULL,
  options         JSONB NOT NULL,       -- [{key,text}]
  correct_key     TEXT NOT NULL,
  explanation     TEXT
);
ALTER TABLE faculty_exam_questions ENABLE ROW LEVEL SECURITY; -- sem policy: só service role
CREATE INDEX IF NOT EXISTS faculty_exam_questions_exam_idx ON faculty_exam_questions (faculty_exam_id, ord);
