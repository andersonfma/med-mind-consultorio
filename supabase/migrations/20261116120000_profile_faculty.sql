-- Dados de perfil do aluno/médico: tipo, faculdade e período/ano de formação.
-- (role já existe e é de AUTORIZAÇÃO — não reutilizar.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type      TEXT;  -- 'student' | 'doctor'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS faculty        TEXT;  -- faculdade (atual do aluno ou onde o médico se formou)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS faculty_period TEXT;  -- período (aluno) ou ano de formação (médico)

-- Trigger de criação do perfil passa a copiar user_type/faculty/faculty_period
-- do metadata do cadastro (não são sensíveis a privilégio). role continua fixo.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'full_name' IS NULL
     OR NEW.raw_user_meta_data->>'full_name' = '' THEN
    RAISE EXCEPTION 'full_name é obrigatório no cadastro';
  END IF;

  INSERT INTO public.profiles (id, full_name, crm, role, user_type, faculty, faculty_period)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(TRIM(NEW.raw_user_meta_data->>'crm'), ''),
    'student',
    NULLIF(TRIM(NEW.raw_user_meta_data->>'user_type'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'faculty'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'faculty_period'), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user() SET search_path = public;
