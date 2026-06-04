-- 1. Add total_slots to existing profiles table
ALTER TABLE profiles
  ADD COLUMN total_slots INTEGER NOT NULL DEFAULT 5
    CHECK (total_slots > 0);

-- 2. Restrict UPDATE on profiles to user-editable columns only
-- total_slots and role must only be changed via service_role (API internal)
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, crm) ON profiles TO authenticated;

-- 3. Create patients table
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  age               INTEGER NOT NULL CHECK (age BETWEEN 18 AND 80),
  gender            TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  specialty         TEXT NOT NULL
                      CHECK (specialty IN (
                        'Clínica Médica', 'Cardiologia', 'Gastroenterologia',
                        'Pneumologia', 'Endocrinologia', 'Nefrologia',
                        'Neurologia', 'Infectologia'
                      )),
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  chief_complaint   TEXT NOT NULL,
  diagnosis         TEXT,
  clinical_status   TEXT NOT NULL,
  bond_level        INTEGER NOT NULL DEFAULT 1
                      CHECK (bond_level BETWEEN 1 AND 5),
  conditions        TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_consulted_at TIMESTAMPTZ
);

CREATE INDEX patients_user_id_idx ON patients(user_id);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON patients TO authenticated;

CREATE POLICY "Aluno lê próprios pacientes"
  ON patients FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprios pacientes"
  ON patients FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprios pacientes"
  ON patients FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 4. Atomic slot check + insert RPC
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
  v_user_id      UUID := auth.uid();
  v_total_slots  INTEGER;
  v_used_slots   INTEGER;
  v_patient      patients;
BEGIN
  SELECT total_slots INTO v_total_slots
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF v_total_slots IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'US002';
  END IF;

  SELECT COUNT(*) INTO v_used_slots
    FROM patients
    WHERE user_id = v_user_id;

  IF v_used_slots >= v_total_slots THEN
    RAISE EXCEPTION 'no_slots_available' USING ERRCODE = 'US001';
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
