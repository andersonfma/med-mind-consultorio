-- Descadastro de emails de engajamento (desafio/novidades). Transacionais (senha) não se aplicam.
-- Alterado só via service role (rota de unsubscribe / admin); authenticated não edita.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_optout BOOLEAN NOT NULL DEFAULT false;
