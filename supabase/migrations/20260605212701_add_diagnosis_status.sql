ALTER TABLE patients
  ADD COLUMN true_diagnosis TEXT,
  ADD COLUMN diagnosis_status TEXT NOT NULL DEFAULT 'none'
    CHECK (diagnosis_status IN ('none', 'achieved', 'revealed'));