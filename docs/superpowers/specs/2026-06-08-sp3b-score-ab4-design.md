# SP3b — Score AB4 (avaliação do raciocínio clínico) — Design

**Data:** 2026-06-08
**Status:** Aprovado (pré-implementação)
**Especialidade do projeto:** Med Mind Simulador — Módulo Consultório (Next.js 16 + Supabase + OpenAI gpt-4o-mini)

## Contexto e objetivo

Hoje o simulador avalia a consulta principalmente pelo desfecho ("diagnóstico alcançado"). O método **AB4** (Anderson Brito, 4 movimentos do raciocínio clínico inspirados na sequência aristotélica) propõe avaliar o **processo de raciocínio**, não o acerto. Este sub-projeto entrega, ao finalizar cada consulta, uma **nota 0–10 por eixo** (A1–A4), uma **nota geral** e uma **recomendação formativa global**, exibidas imediatamente ao aluno.

Princípio central do método (e deste design): **um aluno pode raciocinar bem e errar o diagnóstico, e vice-versa.** O Score AB4 mede a qualidade do raciocínio e é **independente** de o aluno ter alcançado o `true_diagnosis`. O "diagnóstico alcançado" continua sendo métrica separada.

## Os 4 eixos (rubrica)

Derivados dos artigos do método (Table 1 + seção "AB4 and Simulation-Based Education").

- **A1 — Imaginação Poética** — *amplitude de hipóteses e abertura da anamnese.* Alta: explorou vários mundos clínicos possíveis, perguntou o que expandia a cena (cronologia, contexto, exposições, achados negligenciados). Baixa: afunilou cedo, rotulação precoce, anamnese estreita.
- **A2 — Plausibilidade Retórica** — *priorização plausível e mecanismo.* Alta: hierarquizou hipóteses por probabilidade/risco/coerência/fisiopatologia, adequadas a ESTE paciente. Baixa: lista solta, fascínio por diagnóstico raro, sem mecanismo.
- **A3 — Confrontação Dialética** — *justificação dos exames e interpretação dos resultados frente à hipótese.* Alta: para cada exame, o aluno explica por que o pediu e, ao receber o resultado, interpreta-o ligando-o à hipótese (este achado confirma / este enfraquece). Baixa: pede exames sem justificar; ou recebe resultados e não os interpreta / não conecta à hipótese (pediu e ignorou). **Não** se exige que o aluno nomeie exames que refutariam a hipótese.
- **A4 — Demonstração Analítica** — *justificação integrada com incerteza proporcional.* Alta: o pensamento clínico conecta história + exame + exames + mecanismo e justifica, sem excesso de certeza. Baixa: nomeia sem justificar, ou superestima a certeza.

## Escopo

**Dentro:**
- Calcular o Score AB4 (4 eixos 0–10 + nota geral) e uma recomendação global ao finalizar a consulta.
- Persistir o resultado na consulta.
- Exibir o resultado imediatamente, numa tela de resultado pós-finalização.

**Fora (SP futuro):**
- Ranking / leaderboard / gamificação.
- Evolução do score ao longo do tempo / histórico no perfil do aluno.
- Exibição do score no histórico do paciente (apesar de o dado ficar persistido e disponível).
- Gráfico radar (barras simples agora).

## Arquitetura e fluxo

1. Na rota `POST /api/consultations/[id]/finish`, após finalizar a consulta, é feita **uma chamada síncrona best-effort** ao `gpt-4o-mini` com o novo builder `buildAb4ScorePrompt(...)`.
2. O juiz recebe os artefatos da consulta e retorna as 4 notas + a recomendação (JSON).
3. A **nota geral** (média simples dos 4 eixos) é calculada **no código**.
4. O resultado é persistido em `consultations.ab4_score` (JSONB) e incluído na resposta do finish.
5. A `FinishModal` exibe a tela de resultado com as notas + recomendação.

**Entradas do juiz** (todas já existem):
- `chat_history` (anamnese) — sinal de A1/A2
- `exam_requests`: nome + **justificativa** + **resultado** + status — sinal de A3
- resumo do `physical_exam` e `chief_complaint` — contexto
- `clinical_reasoning` do aluno — sinal de A2/A4
- `true_diagnosis` — **apenas contexto**; o prompt trava que a nota não depende do acerto

## Modelo de dados

Nova coluna em `consultations`:

```sql
ALTER TABLE consultations ADD COLUMN ab4_score JSONB;
```

Migration `<timestamp>_add_ab4_score.sql`. Tipos em `src/types/database.ts` atualizados (Row/Insert/Update de `consultations`).

Formato do JSONB persistido:

```json
{
  "a1": 7,
  "a2": 8,
  "a3": 5,
  "a4": 8,
  "overall": 7.0,
  "recommendation": "texto formativo global, enfatizando os eixos mais fracos",
  "generated_at": "2026-06-08T12:00:00.000Z"
}
```

## O prompt do juiz (`buildAb4ScorePrompt`)

Novo builder em `src/lib/consultations/ab4-prompts.ts` (arquivo novo). Estrutura:

1. **Papel e trava de independência.** "Você é um avaliador do método AB4; avalia a QUALIDADE DO RACIOCÍNIO em 4 eixos. O `true_diagnosis` é dado só para você entender o caso — NÃO pontue por o aluno ter acertado ou não."
2. **Rubrica por eixo** (A1–A4 conforme a seção "Os 4 eixos" acima), com o que caracteriza nota alta e nota baixa em cada um.
3. **Calibração da escala 0–10:** `0–2 falha grave/ausente · 3–4 fraco · 5–6 adequado · 7–8 bom · 9–10 excelente`. Instrução explícita: pouca evidência observável (aluno quase não interagiu / pensamento clínico vazio) → nota **baixa** no eixo correspondente, não média.
4. **Recomendação global:** um único texto formativo (≈2–4 frases), priorizando os 1–2 eixos de menor nota, nomeando a falha específica e a conduta de pensamento que faltou. Tom de coaching, em português, dirigido ao aluno ("você…").
5. **Saída** (`response_format: json_object`): `{ "a1": 0-10, "a2": 0-10, "a3": 0-10, "a4": 0-10, "recommendation": "..." }`.

Chamada com **`temperature: 0.3`** (avaliação estável/calibrada).

### Exemplo de recomendação (A3 fraco)

> "Você pediu o hemograma e o ecocardiograma, mas não explicou o que cada resultado significava para sua hipótese. Treine justificar cada exame e, ao ver o resultado, dizer como ele a confirma ou a enfraquece."

## Integração no finish

Em `finish/route.ts`, após o bloco que finaliza a consulta (e podendo reusar dados já carregados):

- Buscar `exam_requests` (nome, justificativa, resultado, status) da consulta.
- Montar o prompt e chamar o juiz (best-effort, `try/catch`, timeout 25s).
- Validar/normalizar a saída (ver "Erros").
- Calcular `overall = média(a1..a4)` (1 casa decimal).
- Gravar `ab4_score` em `consultations` (não-bloqueante).
- Incluir `ab4` no JSON de resposta do finish (ou `ab4: null` em falha).

Resposta do finish passa a ser: `{ patient_id, diagnosis_achieved, ab4 }`.

## UI — tela de resultado

`FinishModal` vira fluxo de dois passos: **confirmar → resultado**. Após `finish` retornar, em vez de redirecionar, mostra:

- "Consulta encerrada" + linha "Diagnóstico: alcançado ✓" (reusa `diagnosis_achieved`).
- **Nota geral** em destaque.
- Os 4 eixos, cada um com barra 0–10 (`div`s, sem lib de gráfico) + número + rótulo do movimento. Eixo(s) de menor nota destacado(s) em cor de alerta (âmbar/vermelho).
- Caixa de **Recomendação** com o texto global.
- Botão **"Ver paciente"** → navega para a página do paciente (comportamento atual).

Se `ab4 === null` (juiz falhou): mostra "Avaliação AB4 indisponível desta vez" + botão "Ver paciente". Finalização não é afetada.

## Erros e resiliência

- Chamada do juiz é **best-effort**: qualquer erro (timeout, JSON inválido, resposta vazia, eixo faltando) → `ab4: null`, finish conclui normalmente (200).
- **Validação da saída:** parse do JSON; cada eixo deve ser número → *clamp* para `[0,10]` e arredonda para inteiro; se algum eixo faltar/for inválido ou o parse falhar → `ab4: null`.
- Gravação do `ab4_score` é não-bloqueante (o finish já retornou status `finished`).

## Testes

- **Unit (`ab4-prompts.test.ts`):** `buildAb4ScorePrompt` contém os 4 eixos, a trava de independência, a escala de calibração e a instrução da recomendação; injeta os artefatos (exame **com resultado** + justificativa + pensamento clínico).
- **Unit (helpers):** cálculo da média geral (média dos 4, 1 casa decimal); função de parse/validação (clamp 0–10, rejeita inválido → null).
- **Unit (`finish/route.test.ts`):** mock do juiz → `ab4` na resposta e persistido; mock de falha → `ab4: null` e finish ainda **200**. Ajustar mocks de `from()` para a nova leitura de `exam_requests`, mantendo asserções existentes.
- **Verificação modelo real** (arquivo temporário, removido depois): dois transcripts — um com raciocínio forte e um fraco (exames sem justificativa e sem interpretação do resultado). Confirmar que as notas **diferenciam** (forte > fraco), que **A3** reage à interpretação dos resultados (definição corrigida) e que a recomendação enfatiza os eixos fracos.

## Estrutura de arquivos

- `supabase/migrations/<ts>_add_ab4_score.sql` — coluna nova (criar)
- `src/types/database.ts` — `ab4_score` nos tipos de `consultations` (modificar)
- `src/lib/consultations/ab4-prompts.ts` — `buildAb4ScorePrompt` + tipos do resultado (criar)
- `src/lib/consultations/ab4-prompts.test.ts` — testes do builder (criar)
- `src/lib/consultations/ab4.ts` — helpers de parse/validação e cálculo da média (criar)
- `src/lib/consultations/ab4.test.ts` — testes dos helpers (criar)
- `src/app/api/consultations/[id]/finish/route.ts` — gerar/persistir/retornar `ab4` (modificar)
- `src/app/api/consultations/[id]/finish/route.test.ts` — testes (modificar)
- `src/app/(dashboard)/consultations/[id]/FinishModal.tsx` — fluxo de 2 passos + tela de resultado (modificar)

## Deploy

- Aplicar a migration `add_ab4_score` na **produção** via Supabase MCP (org "Simulador Med Mind", projeto `zrgjsgorijqlqhvlrpdh`), registrando no `schema_migrations` com a versão do arquivo — **antes** do redeploy do código.
- Depois: merge/commit em `main` → redeploy manual no Easypanel.

## Fora de escopo / futuro

- Ranking, leaderboard e gamificação a partir dos scores persistidos.
- Evolução longitudinal do score (média móvel, tendência por eixo).
- Exibição do score no histórico do paciente e/ou perfil do aluno.
- Gráfico radar dos 4 eixos.
- Score que cruza consultas de um mesmo caso (longitudinal), reabrindo imaginação/plausibilidade a cada retorno — coerente com a Memória do Caso, mas adiado.
