-- Selo premium manual: marca perfis premium. Sem cobrança — decisão feita no /admin.
-- A coluna é lida onde profiles já é lido (feed, perfil, admin); herda o GRANT de SELECT da tabela.
alter table public.profiles add column if not exists is_premium boolean not null default false;
