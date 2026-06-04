CREATE TABLE consultations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'ongoing'
                      CHECK (status IN ('ongoing', 'finished')),
  chat_history      JSONB NOT NULL DEFAULT '[]',
  anamnesis         JSONB NOT NULL DEFAULT '{}',
  clinical_reasoning TEXT NOT NULL DEFAULT '',
  diagnosis         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX consultations_patient_id_idx ON consultations(patient_id);
CREATE INDEX consultations_user_id_idx ON consultations(user_id);

CREATE UNIQUE INDEX consultations_patient_ongoing_idx
  ON consultations(patient_id)
  WHERE status = 'ongoing';

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON consultations TO authenticated;

CREATE POLICY "Aluno lê próprias consultas"
  ON consultations FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprias consultas"
  ON consultations FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprias consultas"
  ON consultations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
