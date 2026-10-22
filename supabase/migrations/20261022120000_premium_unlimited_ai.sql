-- Benefício premium: consultas (chamadas de IA) ILIMITADAS.
-- O teto de uso continua valendo para o plano grátis; quem é is_premium nunca é
-- bloqueado. O uso segue sendo contado (admin continua vendo o volume real).
-- Enforcement centralizado aqui — nenhum endpoint precisa mudar.
CREATE OR REPLACE FUNCTION consume_ai_call()
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_used    INTEGER;
  v_limit   INTEGER;
  v_start   TIMESTAMPTZ;
  v_premium BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT ai_calls_used, ai_calls_limit, ai_period_start, COALESCE(is_premium, false)
    INTO v_used, v_limit, v_start, v_premium
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'US002';
  END IF;

  -- Reinicia a janela deslizante de 30 dias
  IF NOW() - v_start >= INTERVAL '30 days' THEN
    v_used  := 0;
    v_start := NOW();
  END IF;

  -- Premium: sem teto. Grátis: bloqueia ao atingir o limite.
  IF NOT v_premium AND v_used >= v_limit THEN
    RAISE EXCEPTION 'ai_quota_exceeded' USING ERRCODE = 'US010';
  END IF;

  v_used := v_used + 1;

  UPDATE profiles
    SET ai_calls_used   = v_used,
        ai_period_start = v_start
    WHERE id = v_user_id;

  -- Premium recebe um saldo sentinela alto (nunca esgota).
  RETURN CASE WHEN v_premium THEN 999999 ELSE v_limit - v_used END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION consume_ai_call() SET search_path = public;
REVOKE EXECUTE ON FUNCTION consume_ai_call() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_ai_call() TO authenticated;
