-- Anti-cola por COLUNA. A RLS é por linha; sem isto, um cliente autenticado leria
-- correct_key/explanation/true_diagnosis/review direto no PostgREST, driblando a API.
-- Como o SELECT é concedido no nível da TABELA, um REVOKE só de coluna não subtrai nada:
-- é preciso remover o SELECT de tabela e conceder APENAS as colunas seguras.
-- Só o service role (bypassa grants) lê as sensíveis; a API decide quando revelar.

REVOKE SELECT ON quizzes FROM anon, authenticated;
GRANT SELECT (id, author_id, prompt, options, created_at) ON quizzes TO anon, authenticated;

REVOKE SELECT ON weekly_cases FROM anon, authenticated;
GRANT SELECT (id, week_start, specialty, title, overview, created_at) ON weekly_cases TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
