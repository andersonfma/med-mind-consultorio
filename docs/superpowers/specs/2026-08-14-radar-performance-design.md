# Radar de Performance — Track A, fatia 1 (fase 8)

Data: 2026-08-14
Status: aprovado (brainstorming), pronto para plano de implementação

## Objetivo

Representar a evolução do aluno como um gráfico "em teia" (radar) de competências,
agregando os scores que o simulador já produz. Primeira fatia da fase 8 do roadmap.

## Escopo (MVP desta fatia)

- **UM radar agregado do aluno**, exibido no `/dashboard`.
- **Snapshot** da forma de competência atual (3 eixos, 0–10), agregando toda a
  carteira do aluno.
- Fora desta fatia (fatias futuras, nomeadas para não virar escopo silencioso):
  - evolução no tempo / tendência / histórico do radar;
  - radar por paciente/caso;
  - o 4º eixo **Gestão** (depende do Track B — gestão do consultório — existir).

## Os três eixos (cada um 0–10 ou `null`)

Todos agregam sobre as consultas/pacientes do aluno.

1. **Pensamento Clínico (AB4)** — média dos `consultations.ab4_score.overall` das
   consultas que têm AB4 (arco diagnóstico; consultas de seguimento não têm AB4 e
   são ignoradas neste eixo). Sem nenhuma consulta com AB4 → `null`.

2. **Comunicação** — média dos `consultations.communication_score.overall` das
   consultas finalizadas que foram **efetivamente avaliadas**. Uma consulta conta
   só se o juiz de comunicação rodou e parseou (mesmo critério do
   `communicationJudged` no finish: chat vazio / falha de juiz → não conta, não
   entra como zero). Sem nenhuma avaliada → `null`.

3. **Técnica** (novo, **determinístico, sem IA**) — mede o *acerto das decisões*
   clínicas, ortogonal ao AB4 (que mede o processo do raciocínio, independente de
   acertar). É a média das submétricas **que têm dado**:
   - **Acurácia diagnóstica**: entre os casos com diagnóstico fechado
     (`patients.diagnosis_status` ∈ {`achieved`, `revealed`}), fração `achieved`
     × 10. Pacientes com `diagnosis_status = 'none'` não entram (caso ainda aberto).
   - **Adequação de exames**: entre os `exam_requests` com decisão registrada
     (`status` ∈ {`approved`, `rejected`}), fração `approved` × 10.
   - **Adequação de conduta**: média de (`adequada`=10 · `parcial`=5 ·
     `inadequada`=0) sobre as prescrições/condutas com `adequacy` não-nula.
   - Cada submétrica sem dado é **omitida**. Técnica = média simples das presentes.
     Sem nenhuma submétrica com dado → `null`.

### Regra de ouro dos eixos

Eixo sem dado é `null` ("sem dados"), **nunca 0**. Zero puniria o aluno por ainda
não ter gerado aquele sinal — mesmo princípio já adotado no score de comunicação
vazio (não julgado ≠ comunicou mal).

### Pesos

MVP usa **peso igual** entre submétricas presentes da Técnica e média simples
entre consultas nos outros eixos. Reponderação é um ajuste de constante, deixado
para depois se o aluno/usuário quiser.

## Arquitetura

**Sem migration.** Todos os sinais já existem no schema:
`consultations.ab4_score` (JSONB), `consultations.communication_score` (JSONB),
`patients.diagnosis_status` (TEXT), `exam_requests.status` (TEXT),
`prescriptions.adequacy` (TEXT).

Três peças, cada uma com um propósito único:

1. **Lógica pura** — `src/lib/performance/radar.ts`
   - `computeRadar(input: RadarInput): RadarResult`
   - `RadarInput` = dados já agregados/planos do aluno:
     ```
     {
       ab4Overalls: number[]            // overall das consultas com AB4
       communicationOveralls: number[]  // overall das consultas avaliadas
       diagnoses: ('achieved'|'revealed')[]   // casos fechados
       examDecisions: ('approved'|'rejected')[]
       conductAdequacies: ('adequada'|'parcial'|'inadequada')[]
     }
     ```
   - `RadarResult` = `{ pensamentoClinico: number|null, comunicacao: number|null,
     tecnica: number|null, n: number }` (cada eixo 0–10 clampado; `n` = total de
     consultas finalizadas consideradas, para a UI dizer "baseado em N consultas").
   - Puro, sem I/O, sem `openai`, sem Supabase → testável isolado (TDD).

2. **Loader server-side** — agrega as linhas do aluno e monta `RadarInput`.
   - Uma função server-only (ex.: `getRadarData(userId)` em
     `src/lib/performance/loader.ts`) que consulta as tabelas do aluno (respeitando
     RLS / via cliente server) e devolve o `RadarInput`.
   - Agregação **em memória** a partir das linhas existentes (poucas consultas por
     aluno no MVP; `slots=100`). Materialização/coluna cacheada fica para depois se
     o volume crescer.
   - Chamado pelo Server Component do dashboard.

3. **UI** — `src/app/(dashboard)/dashboard/PerformanceRadar.tsx` (client component)
   - Desenha o polígono em **SVG próprio** (sem biblioteca de chart externa —
     coerente com o resto do projeto e com o CSP de artifacts). 3 eixos a 120°,
     escala 0–10, rótulos dos eixos + valor numérico por vértice.
   - Recebe `RadarResult` como prop (Server Component chama o loader e passa o
     resultado — NUNCA passa função como prop, ver padrão do projeto).
   - Tema claro/escuro coerente com o dashboard.

## Estados da UI

- **Vazio** (todos os eixos `null` / `n = 0`): card com mensagem "Faça consultas
  para ver seu radar de performance" + CTA para a carteira.
- **Parcial** (algum eixo `null`): o eixo sem dado é renderizado em cinza/tracejado
  com rótulo "sem dados" e **não** ancora o polígono em 0 (o vértice fica no centro
  visualmente marcado como ausente, não como nota mínima).
- **Cheio**: polígono normal com os 3 valores.

## Erros / bordas

- Aluno sem nenhuma consulta finalizada → estado vazio.
- Eixo/submétrica sem dado → `null`, tratado como "sem dados" (nunca 0).
- Tudo determinístico → **sem timeout, sem best-effort, sem LLM, sem custo**.
- Loader com falha de banco → propaga erro normal do RSC (não é caminho de IA).

## Testes

- `radar.ts` (unit, o coração da lógica):
  - cada eixo calculado corretamente a partir de arrays de exemplo;
  - omissão de submétrica da Técnica quando não há dado;
  - `null` por eixo quando não há nenhum dado daquele eixo;
  - `null` só na submétrica ausente, média das presentes;
  - clamp 0–10; média simples; `n` correto.
- `PerformanceRadar.tsx`: render dos três estados (vazio / parcial / cheio).
- loader: monta `RadarInput` correto a partir de linhas mockadas (agrega e filtra
  consultas de seguimento no eixo AB4, não-avaliadas no eixo Comunicação, casos
  abertos na Acurácia diagnóstica).

## Fora de escopo (reafirmado)

- Evolução no tempo / histórico do radar.
- Radar por paciente.
- Eixo Gestão (fase 8 completa depende do Track B).
- Reponderação configurável dos eixos/submétricas.
