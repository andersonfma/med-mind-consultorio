# Retenção por recurso + Ficha individual — design

**Data:** 2026-11-13
**Status:** aprovado em brainstorming; pendente revisão da spec → plano de implementação

## 1. Contexto e objetivos

O fundador precisa (a) **entender qual recurso mais retém** alunos, (b) ter uma **ficha individual** rica do desempenho de cada aluno em todos os recursos, e (c) **dados agregados** melhor organizados no painel do coordenador (`/admin`).

A pergunta estratégica central: *qual recurso, quando o aluno novo experimenta cedo, faz ele ficar?* Respondida com **retention lift por recurso**, ancorada na **curva de retenção por coorte** (o sinal de PMF que investidores olham).

## 2. Decisões (brainstorming)

- **Retenção = D7:** aluno *retido* = teve **qualquer atividade 7+ dias após o cadastro**.
- Entregar **os dois**: a **curva de retenção** (manchete) e o **lift por recurso** (alavanca).
- **Ficha individual** reorganizada por recurso.
- Avisos permanentes na UI: **N pequeno → direcional, não estatístico**; e **lift = correlação, não prova de causa**.

## 3. Modelo de atividade (fonte dos eventos)

Para cada usuário, montamos o conjunto de eventos `(recurso, timestamp)` a partir das tabelas (todas com `created_at`, ver §9):

| Recurso | Fonte | Campo |
|---|---|---|
| Simulador | `consultations`, `patients` | `created_at` (user_id) |
| Desafio | `quiz_answers` | `created_at` (user_id) |
| Simulados | `exam_attempts` | `created_at` (user_id) — **ver §9** |
| Mapas | `disease_maps` | `created_at` (user_id) |
| Social | `posts` (author_id), `post_reactions` | `created_at` |

Cadastro = `auth.users.created_at` (via `listUsers`). Volume pequeno (~49 usuários, centenas de eventos) → agregação **em memória no request** (sem pré-cálculo por ora; ver §12).

## 4. Retenção D7 (nível usuário)

- **Maturidade:** só entram no cálculo usuários cadastrados **há ≥ 7 dias** (tiveram a chance de voltar). Os mais novos ficam num bucket "jovens demais para avaliar".
- **Retido:** usuário maduro com **≥ 1 evento de atividade com timestamp ≥ cadastro + 7 dias**.
- **D7 geral** = retidos / maduros.

## 5. Curva de retenção (a manchete)

- Curva agregada **dias desde o cadastro → % ainda ativo**, em marcos **D1, D7, D14, D30**: para cada marco `n`, entre os usuários cadastrados há ≥ `n` dias, % com atividade no intervalo `[cadastro+n, hoje]`.
- Opcional (se couber): quebra por **coorte de semana de cadastro** (tabela coorte × marco). Com N pequeno, a curva agregada é a entrega principal; a coorte é complementar.
- Leitura: a curva "achatando" num patamar > 0 é o sinal de PMF.

## 6. Retention lift por recurso (a alavanca)

Para cada recurso F, no universo de **usuários maduros**:
- **adotantes(F)** = usaram F **nos primeiros 7 dias** (evento de F com timestamp ≤ cadastro + 7 dias).
- **não-adotantes(F)** = os demais maduros.
- `ret_adot = retidos entre adotantes / adotantes` ; `ret_nao = retidos entre não-adotantes / não-adotantes`.
- **lift(F) = ret_adot − ret_nao** (em pontos percentuais).
- Tabela ordenada por lift desc: **Recurso · nº adotantes · ret. adotantes · ret. não · lift**.
- Quando um grupo tem base muito pequena (ex.: < 5), marcar o valor como pouco confiável (ex.: "n baixo").

## 7. Ficha individual (`/admin/[id]`) reorganizada

Painel por aluno, por recurso:
- **Cabeçalho:** nome, e-mail, instituição, Premium, **status de retenção** (Retido / Em risco / Novo) e **última atividade** (real, como já calculamos no painel).
- **Blocos por recurso:**
  - *Simulador:* nº consultas, finalizadas, **raciocínio AB4** (geral), **comunicação**, taxa de fecho diagnóstico.
  - *Desafio:* dias jogados, % de acerto, streak, MedCoins.
  - *Simulados:* nº feitos, % médio.
  - *Mapas:* nº de mapas gerados (+ link para `/admin/[id]` listando as doenças).
  - *Social:* posts, curtidas dadas, comentários.
- **Linha do tempo de atividade:** eventos do aluno no tempo (quando usou cada recurso) — evidencia o padrão de retorno.

*(A `/admin/[id]` já existe; esta é uma reorganização/enriquecimento, seguindo os padrões atuais.)*

## 8. Agregado — seção "Retenção" no `/admin`

Nova seção no topo do painel:
- **D7 geral** (card) + a **curva** (D1/D7/D14/D30).
- A **tabela de lift por recurso** (§6).
- Avisos de N pequeno / correlação.

## 9. Mudança de dados

- Migration pequena: `ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();` — para os simulados entrarem na análise temporal. (Linhas antigas recebem `now()` no backfill do default; aceitável — são poucas e o impacto é só na janela histórica dos simulados.)

## 10. Arquitetura

- **Lib pura e testável:** `src/lib/admin/retention.ts` com funções puras:
  - `buildActivityByUser(sources) → Map<userId, {feature, ts}[]>`
  - `isMature(signupTs, now)`, `isRetainedD7(signupTs, events, now)`
  - `retentionCurve(users, now) → { d1, d7, d14, d30 }`
  - `featureLift(users, now) → Array<{ feature, adopters, retAdopt, retNon, lift }>`
  - Entradas são dados simples (timestamps), sem acoplar ao Supabase → testes com Vitest (TDD).
- **Consumo:** o `/admin/page.tsx` (agregado) e o `/admin/[id]/page.tsx` (ficha) buscam os dados (service role) e chamam a lib. Server components, `force-dynamic`.
- Componentes de UI reaproveitam os já existentes (`StatCard`, `Panel`, `AxisBars`, `DistBars`) e um novo para a curva e a tabela de lift.

## 11. Caveats (exibidos na UI)

- **N pequeno:** resultados direcionais, não estatísticos.
- **Correlação ≠ causa:** o lift aponta onde agir e testar, não prova causalidade.
- `last_sign_in_at` não é usado como atividade (já aprendido) — atividade vem dos eventos reais (§3).

## 12. Fora de escopo (v1) / futuro

- Pré-cálculo (materialized view / tabela de eventos) — só quando o volume exigir.
- Coortes detalhadas semana a semana com gráfico; curvas de sobrevivência.
- Lift com significância estatística (quando N permitir).
- Funil por recurso / drill-down por evento.

## 13. Sequência

1. Migration `exam_attempts.created_at` (§9).
2. Lib `retention.ts` + testes (§10).
3. Agregado: seção "Retenção" no `/admin` (curva + lift) — **o foco do fundador**.
4. Ficha individual enriquecida (`/admin/[id]`).

## 14. Critérios de sucesso (v1)

- No `/admin`, ver a **D7 geral**, a **curva** e a **tabela de lift por recurso** ordenada — respondendo "qual recurso mais retém".
- Na `/admin/[id]`, ver o desempenho do aluno **em todos os recursos** + status de retenção + linha do tempo.
- Avisos de N pequeno e correlação visíveis.
- Simulados entram na análise temporal.
