-- Notificações in-app. Destinatário vê as suas; escrita via service role (as rotas gravam).
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,   -- destinatário
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,           -- quem gerou
  type TEXT NOT NULL CHECK (type IN ('like','comment','follow','doubt_answer')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,                 -- alvo (quando aplicável)
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- destinatário lê e marca as suas como lidas; INSERT só via service role (sem policy p/ authenticated)
DROP POLICY IF EXISTS notifications_sel ON notifications;
CREATE POLICY notifications_sel ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notifications_upd ON notifications;
CREATE POLICY notifications_upd ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
