-- Corrige handle_new_user para salvar o CRM informado no cadastro
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'full_name' IS NULL
     OR NEW.raw_user_meta_data->>'full_name' = '' THEN
    RAISE EXCEPTION 'full_name é obrigatório no cadastro';
  END IF;

  INSERT INTO public.profiles (id, full_name, crm, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(TRIM(NEW.raw_user_meta_data->>'crm'), ''),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user() SET search_path = public;
