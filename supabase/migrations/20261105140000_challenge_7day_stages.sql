-- Desafio de 7 dias: o CHECK de challenge_days.stage só aceitava as 5 etapas antigas,
-- então inserir um caso com 'sintese'/'complicacoes' falhava ("persist failed") e o
-- gerador de segunda parou. Recriamos o CHECK com as 7 etapas.
-- O CHECK inline nasce auto-nomeado; dropamos qualquer CHECK de stage por DO-block.
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.challenge_days'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%stage%'
  LOOP
    EXECUTE format('ALTER TABLE public.challenge_days DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.challenge_days
  ADD CONSTRAINT challenge_days_stage_check
  CHECK (stage IN ('anamnese','exame','complementares','sintese','conduta','complicacoes','conclusao'));

-- day_index também era limitado a 1..5 (bloqueava os dias 6 e 7). Recria para 1..7.
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.challenge_days'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%day_index%'
  LOOP
    EXECUTE format('ALTER TABLE public.challenge_days DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.challenge_days
  ADD CONSTRAINT challenge_days_day_index_check CHECK (day_index BETWEEN 1 AND 7);
