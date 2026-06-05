ALTER TABLE consultations
  ADD COLUMN physical_exam JSONB NOT NULL DEFAULT '{}';
