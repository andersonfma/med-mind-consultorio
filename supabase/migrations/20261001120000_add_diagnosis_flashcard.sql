-- Flashcard de revisão do diagnóstico, gerado ao revelar/concluir o diagnóstico.
-- Armazena um JSON (string) com os campos do flashcard educativo. Exibido na
-- página do paciente após a revelação, para revisão.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS diagnosis_flashcard TEXT;
