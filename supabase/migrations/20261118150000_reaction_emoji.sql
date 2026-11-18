-- Reações com emoji variado (antes era só ♥). Uma reação por usuário por post
-- (PK post_id+user_id mantida); o emoji escolhido fica na coluna. NULL = legado (♥).
ALTER TABLE post_reactions ADD COLUMN IF NOT EXISTS emoji TEXT;
