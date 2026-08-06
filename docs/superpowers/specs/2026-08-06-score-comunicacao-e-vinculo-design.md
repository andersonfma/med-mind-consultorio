# Score de Comunicação + Vínculo v2 — Design

**Data:** 2026-08-06
**Contexto:** Módulo Consultório do Med Mind Simulador. Sub-projeto 1 da fase 8 (o radar de performance vem depois, já com este eixo real).
**Status:** aprovado no brainstorming; pronto para plano.

## Motivação

O radar de performance previa um eixo "Comunicação", mas **nada hoje mede a comunicação**. Os eixos do AB4 (A1–A4) medem raciocínio; o "A2 Retórico" é priorização de hipóteses, não diálogo. O vínculo é dirigido por nº de consultas + A2 — também não mede como o aluno conversou. Este sub-projeto cria um avaliador real de comunicação e o incorpora ao vínculo.

## Parte 1 — Score de Comunicação (irmão do AB4)

Um juiz de IA lê a conversa médico-paciente (chat) e pontua **como o aluno conversou**, INDEPENDENTE de acertar o diagnóstico (mesma trava de independência do AB4).

### 3 facetas (0–10 inteiros) + overall

- **C1 — Clareza & linguagem:** adequação dos termos técnicos à compreensão do paciente (não despeja jargão sem explicar), clareza das perguntas e orientações.
- **C2 — Empatia & acolhimento:** escuta, validação do que o paciente sente, tom humano.
- **C3 — Condução da entrevista:** organização, perguntas abertas→dirigidas, deixou o paciente falar sem atropelar.
- `overall = round1((c1 + c2 + c3) / 3)`.
- **recommendation:** texto formativo curto (2–4 frases, "você...", tom de coaching), focando a faceta de MENOR nota.

### Arquitetura (espelha o AB4)

- `src/lib/consultations/communication.ts`:
  - `interface CommunicationResult { c1: number; c2: number; c3: number; overall: number; recommendation: string }`
  - `parseCommunicationResponse(raw: string): CommunicationResult | null` — JSON.parse, clamp 0–10 de c1/c2/c3, exige recommendation não vazia; overall calculado; retorna null em invalidez.
  - `emptyCommunicationResult(): CommunicationResult` — zeros + recomendação fixa `EMPTY_COMMUNICATION_RECOMMENDATION` (quando o aluno mal conversou / chat vazio).
- `src/lib/consultations/communication-prompts.ts`:
  - `buildCommunicationPrompt(patient, chatHistory): string` — rubrica com as 3 facetas + trava de independência (não avaliar acerto do diagnóstico) + saída JSON `{ c1, c2, c3, recommendation }`.
- **Coluna** `consultations.communication_score JSONB` (migration nova). Armazena `{ ...CommunicationResult, generated_at }`.

### Quando e como

- Avaliado em **TODA consulta finalizada** (comunicação acontece sempre — mais simples que o AB4 faseado). Best-effort no `finish/route.ts`: `MODELS.utility`, `response_format json_object`, `temperature 0.3`, timeout 25s. Falha → não grava, não quebra o finish.
- **Chat vazio / quase sem fala do aluno** → `emptyCommunicationResult()` (não chama o juiz). Critério: nenhuma mensagem `role === 'student'` no `chat_history`.
- Diferente do AB4, NÃO é pulado em consulta de seguimento — comunicação vale sempre.
- Exibido no `FinishModal` e no `ConsultationReadOnly`, ao lado do AB4 (mesmo padrão visual: 3 facetas + overall + recomendação).

## Parte 2 — Vínculo v2 (`nextBondLevel` com A2 + Comunicação)

O vínculo passa a evoluir por DOIS sinais. Assinatura nova:

```ts
nextBondLevel(current: number, a2: number | null, communication: number | null): number
```

Matriz do incremento (a comunicação manda no sinal; o A2 amplifica quando a comunicação não é ruim):

| Comunicação (0–10) | A2 alto (≥7) | A2 não-alto |
|---|---|---|
| Boa (≥7) | +2 | +1 |
| Ok (4–6) | +1 | 0 |
| Ruim (≤3) | −1 | −1 |

- **Comunicação ruim (≤3) reduz o vínculo (−1) SEMPRE**, ignorando o A2 ("completo tecnicamente mas comunica mal → perde vínculo").
- `base = clamp(current, 1, 5)`; resultado `clamp(base + inc, 1, 5)`.
- **Fallbacks:**
  - `communication === null` (juiz falhou) → cai no comportamento ANTIGO baseado só em A2 (a2≥7 → +2, a2≤3 → +0, senão +1; a2 null → +1). Preserva compatibilidade e não pune por falha técnica.
  - `communication` presente, `a2 === null` (retorno sem AB4) → trata A2 como "não-alto" (coluna direita da matriz).

### Wiring no finish

No `finish/route.ts`, o bloco de bond hoje é `nextBondLevel(currentBond, a2)` após o bloco AB4. Passa a `nextBondLevel(currentBond, a2, communicationOverall)`, onde `communicationOverall` vem do score de comunicação computado nesta consulta (Parte 1). A avaliação de comunicação roda ANTES do bloco de bond.

## Fora de escopo (YAGNI — próximas fatias)

- O radar de performance em si (próximo sub-projeto, agora com 3 eixos reais: Pensamento Clínico + Comunicação + Técnica).
- Herança longitudinal do score de comunicação entre consultas (cada consulta é avaliada isoladamente).
- Sub-notas de comunicação no dashboard.

## Arquivos afetados (mapa)

- **Criar** `src/lib/consultations/communication.ts` (+ test) e `communication-prompts.ts` (+ test).
- **Criar** migration `supabase/migrations/<ts>_add_communication_score.sql` (coluna JSONB).
- **Modificar** `src/lib/prescriptions/adherence.ts` — `nextBondLevel` ganha 3º param `communication` + matriz. (+ test existente `adherence.test.ts`.)
- **Modificar** `src/app/api/consultations/[id]/finish/route.ts` — avaliar comunicação (best-effort, grava `communication_score`); passar o overall ao `nextBondLevel`.
- **Modificar** `FinishModal.tsx` e `ConsultationReadOnly.tsx` — exibir o score de comunicação (3 facetas + overall + recomendação), ao lado do AB4.
- **Modificar** `src/types/database.ts` — regenerar após migration (`communication_score`).
- Callers de `nextBondLevel` — atualizar para a nova assinatura (3 args).

## Testes

- `communication.ts`: `parseCommunicationResponse` (válido → c1/c2/c3 clamp + overall; inválido/JSON ruim/sem recommendation → null); `emptyCommunicationResult` (zeros + recomendação fixa).
- `communication-prompts.ts`: o prompt contém as 3 facetas nomeadas + a trava de independência + o formato JSON pedido.
- `nextBondLevel` (adherence.test.ts): a matriz — boa+A2alto→+2; boa+A2baixo→+1; ok+A2alto→+1; ok+A2não-alto→0; ruim→−1 (ignora A2); clamp topo/piso; fallback communication null → comportamento antigo (A2); a2 null com comunicação presente → coluna "não-alto".
- Eficácia do juiz é probabilística (gpt-4.1-mini) — os testes garantem a instrução no prompt e a matemática do parse/matriz, não o comportamento do modelo.

## Verificação

- `npx vitest run` verde; `npx tsc --noEmit` limpo (exceto validator.ts).
- Migration aplicada em prod ANTES do deploy (padrão do projeto).
- Validação manual pós-deploy: finalizar uma consulta com boa conversa → score de comunicação alto no FinishModal + vínculo sobe; consulta atropelada/cheia de jargão → score baixo + vínculo cai; conferir que o AB4 e o resto do finish seguem intactos.
