-- Stories passam a aceitar vídeo (até 60s, validado no cliente). Recria os CHECKs de kind.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.stories'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP EXECUTE format('ALTER TABLE stories DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;

ALTER TABLE stories ADD CONSTRAINT stories_kind_check CHECK (kind IN ('image','video','card'));
ALTER TABLE stories ADD CONSTRAINT stories_media_check CHECK (
  (kind IN ('image','video') AND media_url IS NOT NULL) OR (kind = 'card' AND consultation_id IS NOT NULL)
);
