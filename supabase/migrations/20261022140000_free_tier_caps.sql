-- Tetos do plano grátis (premium ignora tudo):
--  • grátis: casos só em até 2 especialidades (escolhidas; auto-preenche as 2 primeiras usadas)
--  • grátis: no máximo 5 casos por janela de 30 dias
--  • premium: todas as especialidades + casos ilimitados
-- Substitui o gate antigo de "slots por reputação" (total_slots deixa de ser o limitador).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_specialties TEXT[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION create_patient(
  p_name         TEXT,
  p_age          INTEGER,
  p_gender       TEXT,
  p_specialty    TEXT,
  p_difficulty   TEXT,
  p_complaint    TEXT,
  p_status       TEXT,
  p_conditions   TEXT[]
) RETURNS patients AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_premium     BOOLEAN;
  v_free_specs  TEXT[];
  v_month_count INTEGER;
  v_patient     patients;
  c_free_cases  CONSTANT INTEGER := 5;  -- casos/30 dias no grátis (dial)
  c_free_specs  CONSTANT INTEGER := 2;  -- especialidades no grátis
BEGIN
  SELECT COALESCE(is_premium, false), COALESCE(free_specialties, '{}')
    INTO v_premium, v_free_specs
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'US002';
  END IF;

  IF NOT v_premium THEN
    -- Especialidade permitida? Auto-preenche o conjunto até 2; a 3ª bloqueia.
    IF NOT (p_specialty = ANY(v_free_specs)) THEN
      IF COALESCE(array_length(v_free_specs, 1), 0) < c_free_specs THEN
        v_free_specs := array_append(v_free_specs, p_specialty);
        UPDATE profiles SET free_specialties = v_free_specs WHERE id = v_user_id;
      ELSE
        RAISE EXCEPTION 'specialty_locked' USING ERRCODE = 'US012';
      END IF;
    END IF;

    -- Teto mensal (janela deslizante de 30 dias).
    SELECT COUNT(*) INTO v_month_count
      FROM patients
      WHERE user_id = v_user_id
        AND created_at >= NOW() - INTERVAL '30 days';

    IF v_month_count >= c_free_cases THEN
      RAISE EXCEPTION 'free_case_limit' USING ERRCODE = 'US011';
    END IF;
  END IF;

  INSERT INTO patients (
    user_id, name, age, gender, specialty, difficulty,
    chief_complaint, clinical_status, conditions
  ) VALUES (
    v_user_id, p_name, p_age, p_gender, p_specialty, p_difficulty,
    p_complaint, p_status, p_conditions
  ) RETURNING * INTO v_patient;

  RETURN v_patient;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[])
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) TO authenticated;
