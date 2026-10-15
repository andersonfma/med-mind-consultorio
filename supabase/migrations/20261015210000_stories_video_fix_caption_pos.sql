-- Fix: a policy de INSERT de stories barrava 'video' (só permitia image/card). Inclui video.
DROP POLICY IF EXISTS stories_ins ON stories;
CREATE POLICY stories_ins ON stories FOR INSERT WITH CHECK (
  auth.uid() = author_id AND (
    kind IN ('image','video')
    OR (kind = 'card' AND EXISTS (SELECT 1 FROM consultations c WHERE c.id = consultation_id AND c.user_id = auth.uid()))
  )
);

-- Posição normalizada (0..1) da legenda sobre a mídia (texto arrastável estilo IG).
ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption_x REAL;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption_y REAL;
