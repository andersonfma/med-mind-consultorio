-- Códigos de fundador: concedem Premium por um período (ex.: 1 ano) sem checkout.
-- Usados em ações presenciais (ex.: aula na Hepatoliga Unirio, código BJ2K29).
-- Reaproveita profiles.is_premium + premium_until; um cron diário expira o acesso.

CREATE TABLE IF NOT EXISTS founder_codes (
  code        TEXT PRIMARY KEY,           -- sempre em MAIÚSCULAS
  label       TEXT,                        -- origem (ex.: "Hepatoliga Unirio")
  grant_days  INTEGER NOT NULL DEFAULT 365,-- dias de Premium concedidos
  max_uses    INTEGER,                     -- NULL = ilimitado
  uses        INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ,                 -- validade do CÓDIGO (não do benefício)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE founder_codes ENABLE ROW LEVEL SECURITY; -- sem policy: só via RPC/service role

CREATE TABLE IF NOT EXISTS founder_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL REFERENCES founder_codes(code),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_until TIMESTAMPTZ NOT NULL,
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, user_id)                   -- um usuário resgata cada código uma vez
);
ALTER TABLE founder_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY founder_redemptions_self ON founder_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Selo de fundador no perfil (para destaque na comunidade, opcional).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT false;

-- Resgata um código para o usuário autenticado. Retorna JSON com o resultado.
-- SECURITY DEFINER: lê founder_codes (sob RLS) e escreve em profiles.
CREATE OR REPLACE FUNCTION redeem_founder_code(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_norm TEXT := upper(trim(p_code));
  v_code founder_codes%ROWTYPE;
  v_until TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  -- Trava a linha do código para evitar corrida no limite de usos.
  SELECT * INTO v_code FROM founder_codes WHERE code = v_norm FOR UPDATE;
  IF NOT FOUND OR NOT v_code.active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Já resgatou antes? Trata como sucesso (idempotente), sem conceder de novo.
  IF EXISTS (SELECT 1 FROM founder_redemptions WHERE code = v_norm AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.uses >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'exhausted');
  END IF;

  v_until := NOW() + make_interval(days => v_code.grant_days);

  UPDATE profiles
     SET is_premium    = true,
         is_founder    = true,
         premium_until = GREATEST(COALESCE(premium_until, NOW()), v_until)
   WHERE id = v_uid;

  INSERT INTO founder_redemptions (code, user_id, granted_until)
  VALUES (v_norm, v_uid, v_until);

  UPDATE founder_codes SET uses = uses + 1 WHERE code = v_norm;

  RETURN jsonb_build_object('ok', true, 'premium_until', v_until, 'days', v_code.grant_days);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION redeem_founder_code(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION redeem_founder_code(TEXT) TO authenticated;

-- Código da turma da Hepatoliga Unirio: 1 ano de Premium, até 200 alunos.
INSERT INTO founder_codes (code, label, grant_days, max_uses)
VALUES ('BJ2K29', 'Hepatoliga Unirio', 365, 200)
ON CONFLICT (code) DO NOTHING;
