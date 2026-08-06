# Score de Comunicação + Vínculo v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avaliar a comunicação médico-paciente por consulta (juiz de IA, 3 facetas) e fazer o vínculo evoluir por A2 + comunicação (comunicação ruim reduz o vínculo).

**Architecture:** Espelha o AB4. `communication.ts` (parse/clamp/empty) + `communication-prompts.ts` (rubrica das 3 facetas) alimentam um passo best-effort no `finish/route.ts` que grava `consultations.communication_score` (JSONB) e passa o overall ao `nextBondLevel(current, a2, communication)`. Exibido no FinishModal e no modo leitura, ao lado do AB4.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), OpenAI (`MODELS.utility` = gpt-4.1-mini), Vitest, TypeScript.

## Global Constraints

- `openai` é NAMED export: `import { openai } from '@/lib/openai/client'`. Client tem `import 'server-only'` → testes de rota precisam de `vi.mock('server-only', () => ({}))`.
- Passo de comunicação no finish é **best-effort**: `MODELS.utility`, `response_format json_object`, `temperature 0.3`, timeout 25s. Falha → não grava, não quebra o finish.
- Score de comunicação é **INDEPENDENTE de acertar o diagnóstico** (mede como conversou). Trava de independência no prompt.
- 3 facetas 0–10 inteiras + `overall = round1((c1+c2+c3)/3)`: **C1 Clareza & linguagem**, **C2 Empatia & acolhimento**, **C3 Condução da entrevista**.
- Chat sem NENHUMA mensagem `role === 'student'` → `emptyCommunicationResult()` (não chama o juiz).
- Avaliado em TODA consulta finalizada (NÃO pulado em seguimento, diferente do AB4).
- **Vínculo v2 — matriz de `nextBondLevel(current, a2, communication)`** (comunicação manda; A2 amplifica):
  - comunicação ≥7: A2≥7 → +2, senão +1
  - comunicação 4–6: A2≥7 → +1, senão 0
  - comunicação ≤3: **−1 sempre** (ignora A2)
  - `communication === null` → comportamento ANTIGO (só A2: ≥7 +2, ≤3 +0, senão +1; a2 null → +1)
  - `clamp(base+inc, 1, 5)`, `base = clamp(current,1,5)`.
- Migration aplicada em prod ANTES do deploy. tsc limpo exceto validator.ts: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
- Sem env nova.

---

## File Structure

- `src/lib/consultations/communication.ts` — **Create**: tipos + parse + empty. + `communication.test.ts`.
- `src/lib/consultations/communication-prompts.ts` — **Create**: `buildCommunicationPrompt`. + `communication-prompts.test.ts`.
- `src/lib/prescriptions/adherence.ts` — **Modify**: `nextBondLevel` ganha 3º param `communication`. + `adherence.test.ts`.
- `supabase/migrations/<ts>_add_communication_score.sql` — **Create**: coluna JSONB.
- `src/types/database.ts` — **Modify**: `communication_score` em consultations (Row/Insert/Update).
- `src/app/api/consultations/[id]/finish/route.ts` — **Modify**: avaliar comunicação, gravar, passar overall ao bond, retornar no JSON.
- `src/app/(dashboard)/consultations/[id]/FinishModal.tsx` — **Modify**: exibir comunicação.
- `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx` — **Modify**: exibir comunicação.

---

## Task 1: Lib do avaliador de comunicação (`communication.ts` + `communication-prompts.ts`)

**Files:**
- Create: `src/lib/consultations/communication.ts`
- Create: `src/lib/consultations/communication-prompts.ts`
- Test: `src/lib/consultations/communication.test.ts`
- Test: `src/lib/consultations/communication-prompts.test.ts`

**Interfaces:**
- Consumes: `Patient` de `@/types/domain`; `ChatMessage` de `./prompts`.
- Produces:
  - `interface CommunicationResult { c1: number; c2: number; c3: number; overall: number; recommendation: string }`
  - `EMPTY_COMMUNICATION_RECOMMENDATION: string`
  - `emptyCommunicationResult(): CommunicationResult`
  - `parseCommunicationResponse(raw: string): CommunicationResult | null`
  - `buildCommunicationPrompt(patient: Patient, chatHistory: ChatMessage[]): string`

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/consultations/communication.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCommunicationResponse, emptyCommunicationResult, EMPTY_COMMUNICATION_RECOMMENDATION } from './communication'

describe('parseCommunicationResponse', () => {
  it('parseia c1/c2/c3 e calcula o overall (média, 1 casa)', () => {
    const r = parseCommunicationResponse('{"c1":8,"c2":6,"c3":7,"recommendation":"bom diálogo"}')
    expect(r).toEqual({ c1: 8, c2: 6, c3: 7, overall: 7, recommendation: 'bom diálogo' })
  })

  it('faz clamp de notas fora de 0–10 e arredonda', () => {
    const r = parseCommunicationResponse('{"c1":12,"c2":-3,"c3":5.4,"recommendation":"x"}')
    expect(r).toEqual({ c1: 10, c2: 0, c3: 5, overall: 5, recommendation: 'x' })
  })

  it('retorna null se faltar nota, recommendation vazia, ou JSON inválido', () => {
    expect(parseCommunicationResponse('{"c1":8,"c2":6,"recommendation":"x"}')).toBeNull()
    expect(parseCommunicationResponse('{"c1":8,"c2":6,"c3":7,"recommendation":"  "}')).toBeNull()
    expect(parseCommunicationResponse('não é json')).toBeNull()
  })
})

describe('emptyCommunicationResult', () => {
  it('zera as notas e usa a recomendação fixa', () => {
    expect(emptyCommunicationResult()).toEqual({
      c1: 0, c2: 0, c3: 0, overall: 0, recommendation: EMPTY_COMMUNICATION_RECOMMENDATION,
    })
  })
})
```

Create `src/lib/consultations/communication-prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCommunicationPrompt } from './communication-prompts'
import type { Patient } from '@/types/domain'

const patient = { name: 'João', age: 50, chief_complaint: 'dor no peito' } as unknown as Patient
const chat = [
  { role: 'student' as const, content: 'Bom dia, o que o traz aqui?', timestamp: 't' },
  { role: 'patient' as const, content: 'uma dor no peito', timestamp: 't' },
]

describe('buildCommunicationPrompt', () => {
  it('inclui as 3 facetas nomeadas', () => {
    const p = buildCommunicationPrompt(patient, chat)
    expect(p).toMatch(/C1/); expect(p).toMatch(/clareza|linguagem|termos/i)
    expect(p).toMatch(/C2/); expect(p).toMatch(/empatia|acolhimento/i)
    expect(p).toMatch(/C3/); expect(p).toMatch(/condu[çc]/i)
  })

  it('traz a trava de independência (não avaliar acerto do diagnóstico)', () => {
    const p = buildCommunicationPrompt(patient, chat)
    expect(p).toMatch(/independente|não.*(premie|penalize|acert)/i)
  })

  it('inclui a conversa e pede JSON com c1/c2/c3/recommendation', () => {
    const p = buildCommunicationPrompt(patient, chat)
    expect(p).toContain('dor no peito')
    expect(p).toContain('"c1"'); expect(p).toContain('"c2"'); expect(p).toContain('"c3"')
    expect(p).toContain('"recommendation"')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/consultations/communication.test.ts src/lib/consultations/communication-prompts.test.ts`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar `communication.ts`**

Create `src/lib/consultations/communication.ts`:

```ts
export interface CommunicationResult {
  c1: number
  c2: number
  c3: number
  overall: number
  recommendation: string
}

/** Recomendação fixa quando o aluno mal conversou (sem fala do médico no chat). */
export const EMPTY_COMMUNICATION_RECOMMENDATION =
  'Você quase não conversou com o paciente nesta consulta, então não há diálogo suficiente para avaliar sua comunicação. Da próxima vez, conduza a entrevista: cumprimente, pergunte de forma clara e em linguagem acessível, e demonstre escuta.'

const clamp = (v: number) => Math.max(0, Math.min(10, Math.round(v)))
const round1 = (v: number) => Math.round(v * 10) / 10

export function emptyCommunicationResult(): CommunicationResult {
  return { c1: 0, c2: 0, c3: 0, overall: 0, recommendation: EMPTY_COMMUNICATION_RECOMMENDATION }
}

/**
 * Valida e normaliza a saída crua do juiz de comunicação. Exige c1/c2/c3 numéricos
 * e recommendation não vazia; caso contrário retorna null ("avaliação indisponível").
 */
export function parseCommunicationResponse(raw: string): CommunicationResult | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }

  const num = (k: string): number | null => {
    const v = obj[k]
    return typeof v === 'number' && !Number.isNaN(v) ? clamp(v) : null
  }
  const c1 = num('c1'), c2 = num('c2'), c3 = num('c3')
  const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation.trim() : ''
  if (c1 === null || c2 === null || c3 === null || !recommendation) return null

  return { c1, c2, c3, overall: round1((c1 + c2 + c3) / 3), recommendation }
}
```

- [ ] **Step 4: Implementar `communication-prompts.ts`**

Create `src/lib/consultations/communication-prompts.ts`:

```ts
import type { Patient } from '@/types/domain'
import type { ChatMessage } from './prompts'

export function buildCommunicationPrompt(patient: Patient, chatHistory: ChatMessage[]): string {
  const conversation = chatHistory.length > 0
    ? chatHistory.map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`).join('\n')
    : '(sem conversa)'

  return `Você é um avaliador de COMUNICAÇÃO médico-paciente. Avalie a QUALIDADE DO DIÁLOGO do aluno (médico) com o paciente nesta consulta simulada.

REGRA DE INDEPENDÊNCIA (CRÍTICA): a nota é INDEPENDENTE de o aluno ter acertado o diagnóstico ou de a conduta clínica ser correta — isso é avaliado em outro lugar. NÃO premie nem penalize pelo acerto clínico; avalie APENAS COMO o aluno se comunicou.

CASO:
Paciente: ${patient.name}, ${patient.age} anos. Queixa: ${patient.chief_complaint}.

CONVERSA (médico-paciente):
${conversation}

EIXOS A AVALIAR (nota inteira de 0 a 10 cada):
- C1 (Clareza & linguagem) — adequação dos termos técnicos à compreensão do paciente e clareza. Nota alta: explica em linguagem acessível, evita jargão sem traduzir, perguntas e orientações claras. Nota baixa: despeja termos técnicos que o paciente leigo não entenderia, perguntas confusas.
- C2 (Empatia & acolhimento) — escuta e validação do que o paciente sente. Nota alta: acolhe, valida a preocupação, tom humano. Nota baixa: frio, ignora o que o paciente traz, mecânico.
- C3 (Condução da entrevista) — organização e ritmo. Nota alta: cumprimenta, abre com pergunta aberta e afunila, deixa o paciente falar sem atropelar, fecha orientando. Nota baixa: interrogatório atropelado, não deixa o paciente responder, desorganizado.

CALIBRAÇÃO DA ESCALA (use toda a escala, não concentre em 7-8):
0-2 falha grave/ausente · 3-4 fraco · 5-6 adequado · 7-8 bom · 9-10 excelente.
Se houver POUCA conversa observável, dê nota BAIXA — ausência de diálogo é nota baixa, não média.

RECOMENDAÇÃO: um único texto formativo curto (2 a 4 frases), em português, dirigido ao aluno ("você..."), focando a faceta de MENOR nota — nomeie a falha específica de comunicação e o que fazer diferente. Tom de coaching.

Responda APENAS com JSON válido, sem texto adicional:
{
  "c1": número inteiro 0-10,
  "c2": número inteiro 0-10,
  "c3": número inteiro 0-10,
  "recommendation": "texto da recomendação"
}`
}
```

- [ ] **Step 5: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/consultations/communication.test.ts src/lib/consultations/communication-prompts.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/consultations/communication.ts src/lib/consultations/communication.test.ts src/lib/consultations/communication-prompts.ts src/lib/consultations/communication-prompts.test.ts
git commit -m "feat(comunicação): lib do avaliador (parse + empty + prompt das 3 facetas)"
```

---

## Task 2: Vínculo v2 — `nextBondLevel(current, a2, communication)`

**Files:**
- Modify: `src/lib/prescriptions/adherence.ts`
- Test: `src/lib/prescriptions/adherence.test.ts`

**Interfaces:**
- Produces: `nextBondLevel(current: number, a2: number | null, communication?: number | null): number`. O 3º param default `null` mantém o comportamento antigo (só A2) para chamadas de 2 args.

**Contexto atual** (`src/lib/prescriptions/adherence.ts`):
```ts
export function nextBondLevel(current: number, a2: number | null): number {
  const base = Math.max(1, Math.min(5, Math.round(current)))
  let inc = 1
  if (a2 !== null) {
    if (a2 >= 7) inc = 2
    else if (a2 <= 3) inc = 0
  }
  return Math.max(1, Math.min(5, base + inc))
}
```

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao `src/lib/prescriptions/adherence.test.ts` um novo bloco (mantenha os testes existentes de `nextBondLevel`, que passam 2 args e devem seguir válidos pelo default null):

```ts
describe('nextBondLevel — vínculo v2 (A2 + comunicação)', () => {
  it('comunicação boa (>=7): A2 alto → +2, A2 não-alto → +1', () => {
    expect(nextBondLevel(1, 8, 8)).toBe(3)   // +2
    expect(nextBondLevel(1, 4, 8)).toBe(2)   // +1
    expect(nextBondLevel(1, null, 9)).toBe(2) // a2 null = não-alto → +1
  })

  it('comunicação ok (4–6): A2 alto → +1, senão 0', () => {
    expect(nextBondLevel(2, 8, 5)).toBe(3)   // +1
    expect(nextBondLevel(2, 3, 5)).toBe(2)   // 0
  })

  it('comunicação ruim (<=3): reduz o vínculo (−1) IGNORANDO o A2', () => {
    expect(nextBondLevel(3, 10, 2)).toBe(2)  // −1 mesmo com A2 alto
    expect(nextBondLevel(3, null, 0)).toBe(2)
  })

  it('clamp no piso 1 e no teto 5', () => {
    expect(nextBondLevel(1, 0, 1)).toBe(1)   // 1 + (−1) = 0 → clamp 1
    expect(nextBondLevel(5, 9, 9)).toBe(5)   // 5 + 2 → clamp 5
  })

  it('communication null → comportamento antigo (só A2)', () => {
    expect(nextBondLevel(1, 8, null)).toBe(3)  // +2
    expect(nextBondLevel(2, 2, null)).toBe(2)  // +0
    expect(nextBondLevel(1, 5, null)).toBe(2)  // +1
    expect(nextBondLevel(1, null, null)).toBe(2) // +1
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/adherence.test.ts`
Expected: FAIL — os casos com 3º arg não batem (assinatura atual ignora comunicação).

- [ ] **Step 3: Implementar**

Substituir a função `nextBondLevel` em `src/lib/prescriptions/adherence.ts` por:

```ts
/**
 * Vínculo (bond_level 1–5) da PRÓXIMA consulta, por DOIS sinais:
 *  - comunicação (0–10) manda no sinal; A2 (0–10, raciocínio) amplifica quando a
 *    comunicação não é ruim.
 *  - comunicação boa (>=7): A2>=7 → +2, senão +1
 *  - comunicação ok (4–6): A2>=7 → +1, senão 0
 *  - comunicação ruim (<=3): −1 SEMPRE (comunicar mal reduz o vínculo, ignora A2)
 *  - communication === null (juiz falhou / ausente): comportamento antigo baseado só em A2.
 * Sempre com clamp em [1, 5].
 */
export function nextBondLevel(current: number, a2: number | null, communication: number | null = null): number {
  const base = Math.max(1, Math.min(5, Math.round(current)))
  const a2High = a2 !== null && a2 >= 7
  let inc: number
  if (communication === null) {
    inc = 1
    if (a2 !== null) {
      if (a2 >= 7) inc = 2
      else if (a2 <= 3) inc = 0
    }
  } else if (communication <= 3) {
    inc = -1
  } else if (communication <= 6) {
    inc = a2High ? 1 : 0
  } else {
    inc = a2High ? 2 : 1
  }
  return Math.max(1, Math.min(5, base + inc))
}
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/prescriptions/adherence.test.ts` → PASS (novos + antigos).
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio (a chamada de 2 args no finish segue válida pelo default).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/adherence.ts src/lib/prescriptions/adherence.test.ts
git commit -m "feat(vínculo): nextBondLevel v2 — A2 + comunicação (comunicação ruim reduz)"
```

---

## Task 3: Migration `communication_score` + tipo

**Files:**
- Create: `supabase/migrations/20260806120000_add_communication_score.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: coluna `consultations.communication_score JSONB` (nullable).

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260806120000_add_communication_score.sql`:

```sql
-- Score de comunicação médico-paciente por consulta (3 facetas + overall + recomendação).
-- Espelha ab4_score. Nullable: consultas antigas / avaliação best-effort que falhou ficam NULL.
ALTER TABLE consultations ADD COLUMN communication_score JSONB;
```

- [ ] **Step 2: Editar `database.ts` à mão**

Em `src/types/database.ts`, na tabela `consultations`, adicionar `communication_score` (JSONB → `Json | null`) nos três blocos, ao lado de `ab4_score`:

- No `Row`: após a linha `ab4_score: Json | null` →

```ts
          communication_score: Json | null
```

- No `Insert`: após `ab4_score?: Json | null` →

```ts
          communication_score?: Json | null
```

- No `Update`: após `ab4_score?: Json | null` →

```ts
          communication_score?: Json | null
```

- [ ] **Step 3: Verificar tsc**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

> Nota: a APLICAÇÃO da migration em prod é feita pelo controlador (fora deste subagente), pois pode exigir restaurar o projeto Supabase (free tier pausa). NÃO chame ferramentas Supabase MCP aqui.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260806120000_add_communication_score.sql src/types/database.ts
git commit -m "feat(comunicação): coluna communication_score em consultations"
```

---

## Task 4: Wiring no `finish/route.ts` (avaliar comunicação + vínculo v2)

**Files:**
- Modify: `src/app/api/consultations/[id]/finish/route.ts`

**Interfaces:**
- Consumes: `buildCommunicationPrompt`, `parseCommunicationResponse`, `emptyCommunicationResult`, `type CommunicationResult` de `@/lib/consultations/communication` e `communication-prompts`; `nextBondLevel` (3 args).

- [ ] **Step 1: Imports**

No topo de `src/app/api/consultations/[id]/finish/route.ts`, adicionar:

```ts
import { buildCommunicationPrompt } from '@/lib/consultations/communication-prompts'
import { parseCommunicationResponse, emptyCommunicationResult, type CommunicationResult } from '@/lib/consultations/communication'
```

- [ ] **Step 2: Bloco de avaliação de comunicação (após o bloco AB4, antes do bloco de vínculo)**

Imediatamente ANTES do comentário `// Evolução do vínculo (best-effort)`, inserir:

```ts
  // Score de comunicação — best-effort, avaliado em TODA consulta finalizada.
  let communication: (CommunicationResult & { generated_at: string }) | null = null
  try {
    const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]
    const hasStudentTurn = chatHistory.some(m => m.role === 'student')
    if (!hasStudentTurn) {
      communication = { ...emptyCommunicationResult(), generated_at: new Date().toISOString() }
    } else {
      const completion = await openai.chat.completions.create({
        model: MODELS.utility,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        messages: [{ role: 'user', content: buildCommunicationPrompt(patient as never, chatHistory) }],
      }, { timeout: 25_000 })
      const raw = completion.choices[0]?.message?.content
      const parsed = raw ? parseCommunicationResponse(raw) : null
      if (parsed) communication = { ...parsed, generated_at: new Date().toISOString() }
    }
    if (communication) {
      await supabase
        .from('consultations')
        .update({ communication_score: communication as unknown as import('@/types/database').Json })
        .eq('id', id)
        .eq('user_id', user.id)
    }
  } catch {
    // best-effort — finish conclui mesmo se a comunicação falhar
  }
```

- [ ] **Step 3: Passar o overall ao vínculo**

No bloco de vínculo, trocar as duas linhas:

```ts
    const a2 = ab4 && typeof ab4.a2 === 'number' ? ab4.a2 : null
    const newBond = nextBondLevel(currentBond, a2)
```

por:

```ts
    const a2 = ab4 && typeof ab4.a2 === 'number' ? ab4.a2 : null
    const commOverall = communication && typeof communication.overall === 'number' ? communication.overall : null
    const newBond = nextBondLevel(currentBond, a2, commOverall)
```

- [ ] **Step 4: Retornar a comunicação no JSON**

Trocar a linha final:

```ts
  return NextResponse.json({ patient_id: patient.id, diagnosis_achieved: diagnosisAchieved, ab4 }, { status: 200 })
```

por:

```ts
  return NextResponse.json({ patient_id: patient.id, diagnosis_achieved: diagnosisAchieved, ab4, communication }, { status: 200 })
```

- [ ] **Step 5: Verificar tsc + suíte**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
Run: `npx vitest run` → verde (pode haver 2 falhas de `specialties.test.ts` que batem no Supabase live se o projeto estiver pausado — ignore se forem só essas).

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/consultations/[id]/finish/route.ts"
git commit -m "feat(comunicação): finish avalia comunicação e alimenta o vínculo v2"
```

---

## Task 5: Exibir o score de comunicação (FinishModal + modo leitura)

**Files:**
- Modify: `src/app/(dashboard)/consultations/[id]/FinishModal.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx`

**Interfaces:**
- Consumes: o campo `communication` do JSON do finish (FinishModal) e `consultation.communication_score` (ConsultationReadOnly; o `page.tsx` já faz `select('*, patients(*)')`, então o campo vem junto).

- [ ] **Step 1: FinishModal — tipo e render**

Em `src/app/(dashboard)/consultations/[id]/FinishModal.tsx`:

(a) após o `type Ab4 = ... | null`, adicionar:

```tsx
type Communication = { c1: number; c2: number; c3: number; overall: number; recommendation: string } | null
```

(b) no `type FinishResult`, adicionar o campo:

```tsx
type FinishResult = { patient_id: string; diagnosis_achieved: boolean; ab4: Ab4; communication: Communication }
```

(c) constante de eixos de comunicação, após a const `AXES`:

```tsx
const COMM_AXES: { key: 'c1' | 'c2' | 'c3'; label: string; sub: string }[] = [
  { key: 'c1', label: 'C1 Clareza', sub: 'Linguagem' },
  { key: 'c2', label: 'C2 Empatia', sub: 'Acolhimento' },
  { key: 'c3', label: 'C3 Condução', sub: 'Entrevista' },
]
```

(d) menor nota de comunicação (para destaque), após o `const minScore`:

```tsx
  const minComm = result?.communication
    ? Math.min(result.communication.c1, result.communication.c2, result.communication.c3)
    : null
```

(e) bloco visual: logo APÓS o fechamento do bloco `{result.ab4 ? (...) : (...)}` (ou seja, após a linha `)}` que fecha o ternário do AB4) e ANTES do `<button ... Ver paciente>`, inserir:

```tsx
            {result.communication && (
              <>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">Score de Comunicação</span>
                  <span className="text-2xl font-bold text-gray-900">{result.communication.overall.toFixed(1)}<span className="text-sm text-gray-400">/10</span></span>
                </div>
                <div className="space-y-2 mb-4">
                  {COMM_AXES.map(ax => {
                    const score = result.communication![ax.key]
                    const weak = score === minComm
                    return (
                      <div key={ax.key} className="flex items-center gap-2">
                        <div className="w-28 shrink-0">
                          <span className="text-xs font-medium text-gray-700">{ax.label}</span>
                          <span className="block text-[10px] text-gray-400">{ax.sub}</span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${weak ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${score * 10}%` }} />
                        </div>
                        <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-amber-600' : 'text-gray-700'}`}>{score}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-5">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Comunicação — recomendação</p>
                  <p className="text-sm text-gray-700">{result.communication.recommendation}</p>
                </div>
              </>
            )}
```

- [ ] **Step 2: ConsultationReadOnly — tipo e render**

Em `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx`:

(a) após o `type Ab4 = {...}`, adicionar:

```tsx
type Communication = { c1: number; c2: number; c3: number; overall: number; recommendation: string }
```

(b) onde hoje lê `const ab4 = (consultation.ab4_score ?? null) as Ab4 | null`, adicionar abaixo:

```tsx
  const communication = (consultation.communication_score ?? null) as Communication | null
  const minComm = communication ? Math.min(communication.c1, communication.c2, communication.c3) : null
  const COMM_AXES: { key: 'c1' | 'c2' | 'c3'; label: string; sub: string }[] = [
    { key: 'c1', label: 'C1 Clareza', sub: 'Linguagem' },
    { key: 'c2', label: 'C2 Empatia', sub: 'Acolhimento' },
    { key: 'c3', label: 'C3 Condução', sub: 'Entrevista' },
  ]
```

(c) logo após o bloco `{ab4 && (<Section title="Score AB4 ...">...</Section>)}`, inserir uma Section análoga para comunicação:

```tsx
        {communication && (
          <Section title="Score de Comunicação">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Diálogo médico-paciente</span>
                <span className="text-2xl font-bold text-gray-900">{communication.overall.toFixed(1)}<span className="text-sm text-gray-400">/10</span></span>
              </div>
              <div className="space-y-2 mb-3">
                {COMM_AXES.map(ax => {
                  const score = communication[ax.key]
                  const weak = score === minComm
                  return (
                    <div key={ax.key} className="flex items-center gap-2">
                      <div className="w-28 shrink-0">
                        <span className="text-xs font-medium text-gray-700">{ax.label}</span>
                        <span className="block text-[10px] text-gray-400">{ax.sub}</span>
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${weak ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${score * 10}%` }} />
                      </div>
                      <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-amber-600' : 'text-gray-700'}`}>{score}</span>
                    </div>
                  )
                })}
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Recomendação</p>
                <p className="text-sm text-gray-700">{communication.recommendation}</p>
              </div>
            </div>
          </Section>
        )}
```

- [ ] **Step 3: Verificar tsc + suíte**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
Run: `npx vitest run` → verde.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/FinishModal.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx"
git commit -m "feat(comunicação): exibir score de comunicação no FinishModal e no modo leitura"
```

---

## Task 6: Verificação final e validação manual

- [ ] **Step 1: Verificação completa**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
Run: `npx vitest run` → todos verdes.

- [ ] **Step 2: Validação manual (pós-deploy — migration aplicada em prod pelo controlador + redeploy manual Easypanel)**

1. Finalizar uma consulta com boa conversa (perguntas claras, acolhimento) → Score de Comunicação alto no FinishModal; conferir no banco que `communication_score` foi gravado e que `bond_level` do paciente subiu.
2. Finalizar uma consulta atropelada / cheia de jargão → score baixo; `bond_level` cai (comunicação ≤3 → −1).
3. Consulta sem o aluno falar → score zerado com a recomendação fixa.
4. Conferir que o AB4 e o resto do finish seguem intactos, e o score aparece também no modo leitura.

> Eficácia do juiz é probabilística (gpt-4.1-mini) — os testes garantem a instrução no prompt e a matemática (parse/matriz), não o comportamento do modelo. Se algum modelo faltar na chave, ver `MODELS.utility`.

---

## Self-Review (do autor do plano)

- **Cobertura do spec:** parse/empty/overall → Task 1 (communication.ts). 3 facetas + independência no prompt → Task 1 (communication-prompts.ts). Matriz do vínculo (A2+comunicação, ruim reduz, fallbacks) → Task 2. Coluna JSONB + tipo → Task 3. Avaliar em toda consulta finalizada + chat vazio → Task 4. Wiring do overall no bond + retorno no JSON → Task 4. Exibição FinishModal + modo leitura → Task 5. Verificação → Task 6. ✅
- **Consistência de tipos:** `CommunicationResult {c1,c2,c3,overall,recommendation}` definido na Task 1, consumido em 4 e 5; `nextBondLevel(current,a2,communication?)` na Task 2, chamado com 3 args na Task 4; `communication_score` (Task 3) lido na Task 5. ✅
- **Sem janela de tsc quebrado:** `nextBondLevel` ganha o 3º param com default `null` (Task 2), então a chamada de 2 args no finish segue compilando até a Task 4 trocar para 3 args. ✅
- **Placeholders:** nenhum — todo passo com código completo. ✅
- **Aplicação da migration:** feita pelo controlador (pode exigir restaurar o Supabase pausado); Task 3 só cria o arquivo + hand-edit do tipo, sem tocar MCP. Regeneração canônica de `database.ts` fica dispensada (hand-edit cobre, e regen removeria `graphql_public` — mesma lição do slice de conduta).
