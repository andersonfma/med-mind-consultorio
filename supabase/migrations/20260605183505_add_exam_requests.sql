CREATE TABLE exam_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name       TEXT NOT NULL CHECK (length(exam_name) BETWEEN 1 AND 500),
  justification   TEXT NOT NULL CHECK (length(justification) BETWEEN 1 AND 2000),
  attempts        INTEGER NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  status          TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  ai_feedback     TEXT NOT NULL DEFAULT '',
  result          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX exam_requests_consultation_id_idx ON exam_requests(consultation_id);
CREATE INDEX exam_requests_patient_id_idx ON exam_requests(patient_id);

ALTER TABLE exam_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON exam_requests TO authenticated;

CREATE POLICY "Aluno lê próprios exames"
  ON exam_requests FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprios exames"
  ON exam_requests FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprios exames"
  ON exam_requests FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
