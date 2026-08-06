-- Score de comunicação médico-paciente por consulta (3 facetas + overall + recomendação).
-- Espelha ab4_score. Nullable: consultas antigas / avaliação best-effort que falhou ficam NULL.
ALTER TABLE consultations ADD COLUMN communication_score JSONB;
