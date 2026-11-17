-- SPACES: a rede social vira comunidades/ligas (tribo + pertencimento).
-- Space = comunidade permanente; membership com papel e status (pedir→aceitar).
-- Admin precisa ser premium. Conteúdo reaproveita `posts` via space_id.
-- Toda escrita sensível passa por RPC SECURITY DEFINER / service role (padrão institutions).

CREATE TABLE IF NOT EXISTS spaces (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT,
  owner_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  join_policy    TEXT NOT NULL DEFAULT 'request' CHECK (join_policy IN ('request','invite','open')),
  visibility     TEXT NOT NULL DEFAULT 'public'  CHECK (visibility IN ('public','private')),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY; -- sem policy: acesso via service role/RPC

CREATE TABLE IF NOT EXISTS space_members (
  space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','moderator','member')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','banned')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at    TIMESTAMPTZ,
  PRIMARY KEY (space_id, user_id)
);
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS space_members_user_idx ON space_members (user_id, status);

-- Conteúdo escopado ao space (NULL = post global/legado). Dúvidas/quiz já são posts.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS posts_space_idx ON posts (space_id, created_at DESC);

-- Helper: o chamador é admin ativo (ou dono) do space?
CREATE OR REPLACE FUNCTION is_space_admin(p_space UUID, p_uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM spaces s WHERE s.id = p_space AND s.owner_id = p_uid
  ) OR EXISTS (
    SELECT 1 FROM space_members m
    WHERE m.space_id = p_space AND m.user_id = p_uid AND m.role = 'admin' AND m.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Criar space: exige premium. O criador vira admin ativo.
CREATE OR REPLACE FUNCTION create_space(p_name TEXT, p_slug TEXT, p_description TEXT,
  p_institution_id UUID DEFAULT NULL, p_join_policy TEXT DEFAULT 'request', p_visibility TEXT DEFAULT 'public')
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid(); v_premium BOOLEAN; v_id UUID; v_slug TEXT := lower(trim(p_slug));
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT COALESCE(is_premium, false) INTO v_premium FROM profiles WHERE id = v_uid;
  IF NOT v_premium THEN RETURN jsonb_build_object('ok', false, 'error', 'premium_required'); END IF;
  IF v_slug IS NULL OR v_slug = '' OR p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  IF EXISTS (SELECT 1 FROM spaces WHERE slug = v_slug) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_taken'); END IF;

  INSERT INTO spaces (slug, name, description, owner_id, institution_id, join_policy, visibility)
  VALUES (v_slug, trim(p_name), NULLIF(trim(p_description), ''), v_uid, p_institution_id,
          COALESCE(p_join_policy, 'request'), COALESCE(p_visibility, 'public'))
  RETURNING id INTO v_id;

  INSERT INTO space_members (space_id, user_id, role, status, joined_at)
  VALUES (v_id, v_uid, 'admin', 'active', NOW());

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Pedir para entrar: 'open' entra na hora (active); senão fica 'pending'.
CREATE OR REPLACE FUNCTION request_join_space(p_space UUID)
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid(); v_policy TEXT; v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT join_policy INTO v_policy FROM spaces WHERE id = p_space AND is_active;
  IF v_policy IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  -- Convite-apenas: não aceita auto-pedido.
  IF v_policy = 'invite' THEN RETURN jsonb_build_object('ok', false, 'error', 'invite_only'); END IF;
  v_status := CASE WHEN v_policy = 'open' THEN 'active' ELSE 'pending' END;

  INSERT INTO space_members (space_id, user_id, role, status, joined_at)
  VALUES (p_space, v_uid, 'member', v_status, CASE WHEN v_status = 'active' THEN NOW() END)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aprovar membro pendente (admin).
CREATE OR REPLACE FUNCTION approve_member(p_space UUID, p_user UUID)
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT is_space_admin(p_space, v_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  UPDATE space_members SET status = 'active', joined_at = COALESCE(joined_at, NOW())
   WHERE space_id = p_space AND user_id = p_user AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover membro (admin). Não remove o dono.
CREATE OR REPLACE FUNCTION remove_member(p_space UUID, p_user UUID)
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT is_space_admin(p_space, v_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF EXISTS (SELECT 1 FROM spaces WHERE id = p_space AND owner_id = p_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_remove_owner'); END IF;
  DELETE FROM space_members WHERE space_id = p_space AND user_id = p_user;
  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Definir papel (admin). Promover a 'admin' exige que o alvo seja premium.
CREATE OR REPLACE FUNCTION set_member_role(p_space UUID, p_user UUID, p_role TEXT)
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid(); v_target_premium BOOLEAN;
BEGIN
  IF NOT is_space_admin(p_space, v_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF p_role NOT IN ('admin','moderator','member') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_role'); END IF;
  IF p_role = 'admin' THEN
    SELECT COALESCE(is_premium, false) INTO v_target_premium FROM profiles WHERE id = p_user;
    IF NOT v_target_premium THEN RETURN jsonb_build_object('ok', false, 'error', 'target_not_premium'); END IF;
  END IF;
  UPDATE space_members SET role = p_role WHERE space_id = p_space AND user_id = p_user AND status = 'active';
  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION create_space(TEXT,TEXT,TEXT,UUID,TEXT,TEXT), request_join_space(UUID),
  approve_member(UUID,UUID), remove_member(UUID,UUID), set_member_role(UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_space(TEXT,TEXT,TEXT,UUID,TEXT,TEXT), request_join_space(UUID),
  approve_member(UUID,UUID), remove_member(UUID,UUID), set_member_role(UUID,UUID,TEXT) TO authenticated;

-- ───────── SEED: space-farol Hepatoliga Unirio ─────────
-- Dono = admin do projeto; membros ativos = quem resgatou o cupom BJ2K29.
DO $$
DECLARE v_owner UUID; v_inst UUID; v_space UUID;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'andersonbrito.a@gmail.com' LIMIT 1;
  SELECT id INTO v_inst FROM institutions WHERE lower(name) = lower('Hepatoliga Unirio') LIMIT 1;
  IF v_owner IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM spaces WHERE slug = 'hepatoliga-unirio') THEN
    INSERT INTO spaces (slug, name, description, owner_id, institution_id, join_policy, visibility)
    VALUES ('hepatoliga-unirio', 'Hepatoliga Unirio',
            'Comunidade da Hepatoliga da UNIRIO — dúvidas, casos e o desafio da semana.',
            v_owner, v_inst, 'request', 'public')
    RETURNING id INTO v_space;

    INSERT INTO space_members (space_id, user_id, role, status, joined_at)
    VALUES (v_space, v_owner, 'admin', 'active', NOW())
    ON CONFLICT DO NOTHING;

    INSERT INTO space_members (space_id, user_id, role, status, joined_at)
    SELECT v_space, r.user_id, 'member', 'active', NOW()
    FROM founder_redemptions r WHERE r.code = 'BJ2K29'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
