-- created_at nos simulados, para entrarem na análise temporal de retenção.
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
