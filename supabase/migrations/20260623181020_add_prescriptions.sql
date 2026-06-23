CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drug_name       TEXT NOT NULL CHECK (length(drug_name) BETWEEN 1 AND 300),
  posology        TEXT NOT NULL CHECK (length(posology) BETWEEN 1 AND 1000),
  source          TEXT NOT NULL DEFAULT 'free' CHECK (source IN ('catalog', 'free')),
  justification   TEXT,
  adequacy        TEXT CHECK (adequacy IN ('adequada', 'parcial', 'inadequada')),
  ai_feedback     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX prescriptions_consultation_id_idx ON prescriptions(consultation_id);
CREATE INDEX prescriptions_patient_active_idx ON prescriptions(patient_id, status);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON prescriptions TO authenticated;

CREATE POLICY "Aluno lê próprias prescrições"
  ON prescriptions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprias prescrições"
  ON prescriptions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprias prescrições"
  ON prescriptions FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
