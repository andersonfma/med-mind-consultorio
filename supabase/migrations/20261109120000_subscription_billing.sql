-- Camada de assinatura (provedor-agnóstica; 1º provedor = Hotmart).
-- O app continua lendo profiles.is_premium (RPC, páginas). premium_until é a VALIDADE:
-- um cron diário desliga is_premium quando vence. Concessões manuais (admin/fundadores)
-- podem ter premium_until nulo (permanente) ou uma data (ex.: 1 ano de fundador).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

-- Auditoria dos eventos de pagamento (idempotência + rastreio).
CREATE TABLE IF NOT EXISTS payment_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT NOT NULL,              -- 'hotmart'
  event       TEXT NOT NULL,              -- PURCHASE_APPROVED, etc.
  external_id TEXT,                       -- id da transação no provedor (idempotência)
  email       TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_events_created_idx ON payment_events (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_ext_idx
  ON payment_events (provider, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY; -- só service role lê/escreve (sem policy)

-- Lookup de user por e-mail (auth.users não é acessível via REST). SECURITY DEFINER,
-- restrito ao service role. Usado pelo webhook para casar o comprador.
CREATE OR REPLACE FUNCTION user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;

-- Expira o premium pago vencido (chamada pelo cron). Não mexe em concessões
-- permanentes (premium_until NULL). Retorna quantos expiraram.
CREATE OR REPLACE FUNCTION expire_premium()
RETURNS INTEGER AS $$
DECLARE n INTEGER;
BEGIN
  WITH upd AS (
    UPDATE profiles SET is_premium = false
    WHERE is_premium = true AND premium_until IS NOT NULL AND premium_until < NOW()
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION expire_premium() FROM PUBLIC, anon, authenticated;
