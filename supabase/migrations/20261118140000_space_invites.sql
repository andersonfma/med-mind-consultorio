-- Convite de Space: link reutilizável (compartilhável no WhatsApp) + convite por
-- e-mail. Entrar pelo link/convite ENTRA DIRETO (bypassa o pedido→aceite), porque
-- quem tem o link foi convidado pelo admin. Vira rota de aquisição: a pessoa pode
-- nem ter conta — o link a leva ao cadastro e, depois, direto para dentro do space.

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- Gera (ou regenera) o token de convite do space. Só admin. Retorna o token.
CREATE OR REPLACE FUNCTION generate_space_invite(p_space UUID, p_regenerate BOOLEAN DEFAULT false)
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid(); v_token TEXT;
BEGIN
  IF NOT is_space_admin(p_space, v_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  SELECT invite_token INTO v_token FROM spaces WHERE id = p_space;
  IF v_token IS NULL OR p_regenerate THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
    UPDATE spaces SET invite_token = v_token WHERE id = p_space;
  END IF;
  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Entra no space pelo token de convite (vira membro ativo na hora).
CREATE OR REPLACE FUNCTION join_space_via_invite(p_token TEXT)
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid(); v_space UUID; v_slug TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT id, slug INTO v_space, v_slug FROM spaces WHERE invite_token = p_token AND is_active;
  IF v_space IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;

  INSERT INTO space_members (space_id, user_id, role, status, joined_at)
  VALUES (v_space, v_uid, 'member', 'active', NOW())
  ON CONFLICT (space_id, user_id) DO UPDATE
    SET status = 'active', joined_at = COALESCE(space_members.joined_at, NOW())
    WHERE space_members.status <> 'banned';

  RETURN jsonb_build_object('ok', true, 'slug', v_slug);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION generate_space_invite(UUID,BOOLEAN), join_space_via_invite(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION generate_space_invite(UUID,BOOLEAN), join_space_via_invite(TEXT) TO authenticated;
