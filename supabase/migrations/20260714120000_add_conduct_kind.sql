-- Conduta terapêutica: distingue medicamento de procedimento/medida não-farmacológica.
-- Linhas existentes (todas fármacos) migram para 'medicamento' via DEFAULT.
ALTER TABLE prescriptions
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'medicamento'
  CHECK (kind IN ('medicamento', 'procedimento', 'medida'));
