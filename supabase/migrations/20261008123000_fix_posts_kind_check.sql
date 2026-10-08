-- A tabela posts nasceu (fatia 1) com um CHECK inline AUTO-NOMEADO (posts_check) cobrindo só
-- card/text. A migration do quiz dropou 'posts_kind_check' (nome que não existia) e criou o
-- novo — mas o CHECK antigo continuou barrando kind quiz/duvida/resenha (erro 23514).
-- Remove TODO CHECK de posts cuja definição mencione "kind" e recria o correto.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE posts ADD CONSTRAINT posts_kind_check CHECK (
  (kind = 'card' AND (consultation_id IS NOT NULL OR ranking_snapshot IS NOT NULL)) OR
  (kind = 'text' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'duvida' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'resenha' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'quiz' AND quiz_id IS NOT NULL)
);
