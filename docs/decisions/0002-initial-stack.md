# ADR 0002 - Stack Inicial Do MVP

Data: 2026-05-16

## Status

Proposta.

## Contexto

O projeto precisa ser rapido de prototipar pelo Codex, mas tambem precisa ter
caminho realista para produto web, dashboard, API, persistencia e integracao
futura com a Med Mind.

## Decisao

Usar como stack inicial recomendada:

- Next.js;
- TypeScript;
- Prisma;
- SQLite no prototipo local;
- Postgres/Supabase no MVP compartilhado;
- biblioteca de grafico para radar/performance quando a UI for implementada.

## Consequencias

Beneficios:

- prototipo local rapido;
- boa base para dashboard;
- facilidade de migrar SQLite para Postgres;
- tipagem forte para contratos;
- rotas server-side simples para o MVP.

Riscos:

- instalacao de dependencias exigira acesso a internet;
- deploy e banco hospedado exigirao contas/credenciais externas;
- se Med Mind ja usa outra stack, esta decisao deve ser reavaliada antes da
  integracao real.

