-- Fix: role não deve ser controlado pelo usuário no cadastro nem no update

-- Fix 1: Recriar handle_new_user sem aceitar role do metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'full_name' IS NULL
     OR NEW.raw_user_meta_data->>'full_name' = '' THEN
    RAISE EXCEPTION 'full_name é obrigatório no cadastro';
  END IF;

  -- role sempre 'student' no cadastro — elevação requer processo admin
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user() SET search_path = public;

-- Fix 2: UPDATE policy com WITH CHECK que impede alteração de role
DROP POLICY "Usuário edita próprio perfil" ON profiles;

CREATE POLICY "Usuário edita próprio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );
