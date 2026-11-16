-- Painel do gestor de faculdade (B2B). Separa o painel do DONO (/admin, database do
-- negócio) do painel do DIRETOR/COORDENADOR (/faculdade, visão de UMA instituição).

-- 1) Gestores de instituição: quem pode ver o painel de qual faculdade.
--    Sem policy de RLS: todo acesso passa pelo service role no servidor (como institutions).
CREATE TABLE IF NOT EXISTS institution_managers (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'director', -- director | coordinator
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (institution_id, user_id)
);
ALTER TABLE institution_managers ENABLE ROW LEVEL SECURITY;

-- 2) Como a instituição "captura" seus alunos para formar as turmas. A pertença de
--    um aluno é a UNIÃO de: vínculo explícito (institution_id / institution_members),
--    resgate de um cupom de fundador (founder_code) e match pelo nome da faculdade
--    (faculty_match sobre profiles.faculty). Assim a turma de teste da Hepatoliga
--    aparece mesmo sem vínculo manual aluno a aluno.
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS founder_code  TEXT; -- cupom que define a turma (ex.: BJ2K29)
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS faculty_match TEXT; -- nome de faculdade que mapeia para esta instituição (ex.: UNIRIO)

-- 3) Semeia a instituição de teste (Hepatoliga Unirio) se ainda não existir, e
--    aponta o cupom + a faculdade que a alimentam.
INSERT INTO institutions (name, invite_code, founder_code, faculty_match)
SELECT 'Hepatoliga Unirio', 'UNIRIO-HEPATO', 'BJ2K29', 'UNIRIO'
WHERE NOT EXISTS (SELECT 1 FROM institutions WHERE lower(name) = lower('Hepatoliga Unirio'));

-- Se já existia, garante os campos de captura preenchidos.
UPDATE institutions
   SET founder_code  = COALESCE(founder_code, 'BJ2K29'),
       faculty_match = COALESCE(faculty_match, 'UNIRIO')
 WHERE lower(name) = lower('Hepatoliga Unirio');
