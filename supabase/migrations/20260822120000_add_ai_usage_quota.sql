-- Teto de uso de IA por usuário (controle de custo para o cadastro público).
-- Janela deslizante de 30 dias. As colunas NÃO são editáveis pelo aluno
-- (REVOKE UPDATE em profiles já restringe authenticated a full_name/crm);
-- só o RPC consume_ai_call() (SECURITY DEFINER) as altera.

ALTER TABLE profiles
  ADD COLUMN ai_calls_used  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN ai_calls_limit INTEGER     NOT NULL DEFAULT 500 CHECK (ai_calls_limit >= 0),
  ADD COLUMN ai_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Consome 1 chamada de IA do orçamento do usuário atual, de forma atômica.
-- Reinicia a janela quando passa de 30 dias. Lança 'ai_quota_exceeded' (US010)
-- quando o teto é atingido. Retorna o saldo restante.
CREATE OR REPLACE FUNCTION consume_ai_call()
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_used    INTEGER;
  v_limit   INTEGER;
  v_start   TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT ai_calls_used, ai_calls_limit, ai_period_start
    INTO v_used, v_limit, v_start
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

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'ai_quota_exceeded' USING ERRCODE = 'US010';
  END IF;

  v_used := v_used + 1;

  UPDATE profiles
    SET ai_calls_used   = v_used,
        ai_period_start = v_start
    WHERE id = v_user_id;

  RETURN v_limit - v_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION consume_ai_call() SET search_path = public;
REVOKE EXECUTE ON FUNCTION consume_ai_call() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_ai_call() TO authenticated;
