# Conduta terapêutica + critério de melhora no seguimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o paciente melhorar no seguimento quando o aluno acerta a conduta — registrando procedimentos (não só fármacos), destravando o vínculo e julgando a conduta como conjunto.

**Architecture:** A tabela `prescriptions` ganha `kind` (medicamento/procedimento/medida). No encerramento (`finish/route.ts`), um juiz avalia o CONJUNTO da conduta ativa contra o `true_diagnosis` (nota global), o `bond_level` evolui (+1/consulta, modulado pela nota A2 do AB4), e a evolução clínica passa a seguir uma matriz onde conduta adequada NUNCA gera piora.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), OpenAI (gpt-4.1-mini via `MODELS.utility`), Vitest, TypeScript.

## Global Constraints

- `openai` é NAMED export: `import { openai } from '@/lib/openai/client'`.
- Modelo de encanamento invisível = `MODELS.utility`; rotas de avaliação usam `response_format: { type: 'json_object' }` + `timeout: 25_000`.
- Todo passo de IA no `finish` é **best-effort**: falha nunca quebra o finish (try/catch que degrada).
- Feedback/avaliação **NUNCA revela o `true_diagnosis`** (regra já vigente, commit 67b20c5) — vale também para procedimentos.
- Migration aplicada em prod **antes** do deploy do código (evitar descompasso schema↔código).
- `tsc` deve ficar limpo exceto os erros pré-existentes de `validator.ts`: check com `npx tsc --noEmit` e ignorar linhas com `validator.ts`.
- Adesão só modula fármacos de uso contínuo; procedimento executado não depende de adesão.
- Regra dura da matriz: **conduta adequada nunca gera "sem melhora" ou piora** — no máximo melhora parcial.

---

## File Structure

- `supabase/migrations/<ts>_add_conduct_kind.sql` — **Create**: coluna `kind` em `prescriptions`.
- `src/lib/prescriptions/types.ts` — **Modify**: `ConductKind`, campo `kind` em `Prescription`.
- `src/lib/prescriptions/adherence.ts` — **Modify**: novo `nextBondLevel`.
- `src/lib/prescriptions/adherence.test.ts` — **Modify**: testes de `nextBondLevel`.
- `src/lib/prescriptions/conduct-eval.ts` — **Create**: `buildConductEvalPrompt` + `parseConductAdequacy`.
- `src/lib/prescriptions/conduct-eval.test.ts` — **Create**: testes do juiz de conduta global.
- `src/lib/prescriptions/prescription-prompts.ts` — **Modify**: `buildPrescriptionEvalPrompt` aceita `kind`.
- `src/lib/prescriptions/prescription-prompts.test.ts` — **Create**: testa adaptação por `kind`.
- `src/lib/consultations/prompts.ts` — **Modify**: `TreatmentContext` ganha `kind` por item + `conductAdequacy`; matriz nova em `buildFinishPrompt` e `buildCaseSummaryPrompt`.
- `src/lib/consultations/prompts.test.ts` — **Modify/Create**: testa matriz e presença de `kind`.
- `src/app/api/consultations/[id]/prescriptions/route.ts` — **Modify**: aceitar/gravar `kind`; passar `kind` ao eval.
- `src/app/api/consultations/[id]/finish/route.ts` — **Modify**: juiz de conduta global; `bond_level` update; `TreatmentContext` com `kind` + `conductAdequacy`.
- `src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx` — **Modify**: título "Conduta", seletor de tipo.
- `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx` — **Modify**: exibir `kind`.
- `src/app/(dashboard)/consultations/[id]/page.tsx` — **Modify**: incluir `kind` no select do modo leitura.
- `src/types/database.ts` — **Modify**: regenerar após migration.

---

## Task 1: Migration `kind` + tipos de conduta

**Files:**
- Create: `supabase/migrations/20260714120000_add_conduct_kind.sql`
- Modify: `src/lib/prescriptions/types.ts`

**Interfaces:**
- Produces: `ConductKind = 'medicamento' | 'procedimento' | 'medida'`; `Prescription.kind: ConductKind`.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260714120000_add_conduct_kind.sql`:

```sql
-- Conduta terapêutica: distingue medicamento de procedimento/medida não-farmacológica.
-- Linhas existentes (todas fármacos) migram para 'medicamento' via DEFAULT.
ALTER TABLE prescriptions
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'medicamento'
  CHECK (kind IN ('medicamento', 'procedimento', 'medida'));
```

- [ ] **Step 2: Aplicar a migration em prod (Supabase MCP)**

Aplicar via `mcp__plugin_supabase_supabase__apply_migration` no projeto `zrgjsgorijqlqhvlrpdh` (org "Simulador Med Mind"), name `add_conduct_kind`, com o SQL acima. Confirmar depois com `list_migrations` ou `execute_sql`:

Run (verificação): `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='prescriptions' AND column_name='kind';`
Expected: uma linha `kind | text`.

- [ ] **Step 3: Adicionar os tipos**

Modify `src/lib/prescriptions/types.ts` — adicionar o tipo e o campo:

```typescript
export type ConductKind = 'medicamento' | 'procedimento' | 'medida'
```

E dentro de `interface Prescription`, após `created_at: string`:

```typescript
  kind: ConductKind
```

- [ ] **Step 4: Verificar tsc**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem saída (nenhum erro novo).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714120000_add_conduct_kind.sql src/lib/prescriptions/types.ts
git commit -m "feat(conduta): coluna kind em prescriptions + tipo ConductKind"
```

---

## Task 2: `nextBondLevel` — vínculo que evolui

**Files:**
- Modify: `src/lib/prescriptions/adherence.ts`
- Test: `src/lib/prescriptions/adherence.test.ts`

**Interfaces:**
- Produces: `nextBondLevel(current: number, a2: number | null): number` — vínculo da PRÓXIMA consulta (1..5).

Regra: base `clamp(current,1,5)`; incremento pela nota A2 (Retórico, 0–10) desta consulta — `a2 >= 7 → +2`, `a2 <= 3 → +0`, caso contrário `+1`; `a2 === null` (sem AB4) → `+1`. Resultado com `clamp(1,5)`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `src/lib/prescriptions/adherence.test.ts` (topo do arquivo, ajustar o import):

```typescript
import { estimateAdherence, nextBondLevel } from './adherence'
```

E um novo bloco `describe`:

```typescript
describe('nextBondLevel', () => {
  it('A2 alto (>=7) acelera: +2', () => {
    expect(nextBondLevel(1, 8)).toBe(3)
    expect(nextBondLevel(2, 7)).toBe(4)
  })

  it('A2 baixo (<=3) trava: +0', () => {
    expect(nextBondLevel(2, 2)).toBe(2)
    expect(nextBondLevel(1, 0)).toBe(1)
  })

  it('A2 intermediário: +1', () => {
    expect(nextBondLevel(1, 5)).toBe(2)
    expect(nextBondLevel(3, 6)).toBe(4)
  })

  it('sem AB4 (a2 null): +1 puro', () => {
    expect(nextBondLevel(1, null)).toBe(2)
    expect(nextBondLevel(4, null)).toBe(5)
  })

  it('faz clamp no teto 5 e no piso 1', () => {
    expect(nextBondLevel(5, 9)).toBe(5)
    expect(nextBondLevel(4, 8)).toBe(5)
    expect(nextBondLevel(0, 2)).toBe(1) // current clamp=1, +0
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/adherence.test.ts`
Expected: FAIL — `nextBondLevel is not a function`.

- [ ] **Step 3: Implementar**

Adicionar ao fim de `src/lib/prescriptions/adherence.ts`:

```typescript
/**
 * Vínculo (bond_level 1–5) da PRÓXIMA consulta. Cresce com o tempo de relação
 * (+1 por consulta finalizada) modulado pela competência relacional do aluno,
 * medida pelo eixo A2 (Retórico) do AB4 desta consulta:
 *   A2 >= 7 → +2 (boa escuta acelera o vínculo)
 *   A2 <= 3 → +0 (relação fria não avança)
 *   caso contrário, ou sem AB4 (a2 = null) → +1
 * Sempre com clamp em [1, 5].
 */
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

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/prescriptions/adherence.test.ts`
Expected: PASS (todos, incluindo os antigos de `estimateAdherence`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/adherence.ts src/lib/prescriptions/adherence.test.ts
git commit -m "feat(conduta): nextBondLevel — vínculo evolui por consulta modulado pelo A2"
```

---

## Task 3: Juiz de conduta global (`buildConductEvalPrompt` + parse)

**Files:**
- Create: `src/lib/prescriptions/conduct-eval.ts`
- Test: `src/lib/prescriptions/conduct-eval.test.ts`

**Interfaces:**
- Consumes: `Patient` de `@/types/domain`; `Adequacy`, `ConductKind` de `./types`.
- Produces:
  - `type ConductItem = { drug_name: string; posology: string; kind: ConductKind }`
  - `buildConductEvalPrompt(patient: Patient, conduct: ConductItem[]): string`
  - `parseConductAdequacy(raw: string): Adequacy | null` (null = inválido → chamador degrada para `'parcial'`).

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/prescriptions/conduct-eval.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildConductEvalPrompt, parseConductAdequacy, type ConductItem } from './conduct-eval'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Celina', age: 60, specialty: 'Clínica Médica',
  chief_complaint: 'vômito com sangue', conditions: ['cirrose'],
  true_diagnosis: 'Hemorragia digestiva alta por varizes esofágicas',
} as unknown as Patient

const conduct: ConductItem[] = [
  { drug_name: 'terlipressina', posology: '2mg 4/4h', kind: 'medicamento' },
  { drug_name: 'ligadura elástica', posology: 'sessão inicial', kind: 'procedimento' },
]

describe('buildConductEvalPrompt', () => {
  it('lista o CONJUNTO da conduta com o tipo de cada item', () => {
    const p = buildConductEvalPrompt(patient, conduct)
    expect(p).toContain('terlipressina')
    expect(p).toContain('ligadura elástica')
    expect(p).toContain('procedimento')
  })

  it('avalia o conjunto (não item a item) e pede JSON com adequacy global', () => {
    const p = buildConductEvalPrompt(patient, conduct)
    expect(p).toMatch(/conjunto/i)
    expect(p).toContain('"adequacy"')
  })

  it('proíbe revelar o diagnóstico verdadeiro no texto', () => {
    const p = buildConductEvalPrompt(patient, conduct)
    expect(p).toMatch(/NÃO REVELE O DIAGNÓSTICO/i)
  })
})

describe('parseConductAdequacy', () => {
  it('extrai adequacy válida', () => {
    expect(parseConductAdequacy('{"adequacy":"adequada"}')).toBe('adequada')
    expect(parseConductAdequacy('{"adequacy":"parcial"}')).toBe('parcial')
    expect(parseConductAdequacy('{"adequacy":"inadequada"}')).toBe('inadequada')
  })

  it('retorna null para valor inesperado ou JSON inválido', () => {
    expect(parseConductAdequacy('{"adequacy":"ótima"}')).toBeNull()
    expect(parseConductAdequacy('não é json')).toBeNull()
    expect(parseConductAdequacy('{}')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/conduct-eval.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Create `src/lib/prescriptions/conduct-eval.ts`:

```typescript
import type { Patient } from '@/types/domain'
import type { Adequacy, ConductKind } from './types'

export type ConductItem = { drug_name: string; posology: string; kind: ConductKind }

const KIND_LABEL: Record<ConductKind, string> = {
  medicamento: 'Medicamento',
  procedimento: 'Procedimento',
  medida: 'Medida não-farmacológica',
}

/**
 * Avalia a adequação do CONJUNTO da conduta (fármacos + procedimentos + medidas)
 * contra o diagnóstico verdadeiro. É a nota GLOBAL — resolve o caso em que itens
 * isolados parecem parciais mas juntos formam a conduta correta (ex.: terlipressina
 * sozinha = parcial; terlipressina + ligadura + TIPS = adequada).
 */
export function buildConductEvalPrompt(patient: Patient, conduct: ConductItem[]): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const list = conduct
    .map(c => `- [${KIND_LABEL[c.kind]}] ${c.drug_name} — ${c.posology}`)
    .join('\n')

  return `Você é um supervisor clínico. Avalie a ADEQUAÇÃO do CONJUNTO da conduta terapêutica ao caso.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Diagnóstico verdadeiro do caso (contexto interno): ${trueDiag ?? '(não definido)'}

Conduta ativa do aluno (avalie como CONJUNTO, não item a item):
${list}

Avalie o conjunto como um todo e classifique em UMA faixa:
- "adequada": o conjunto trata corretamente o quadro/diagnóstico (mesmo que um item isolado, sozinho, fosse insuficiente).
- "parcial": conduta na direção certa, mas incompleta ou com ressalva relevante.
- "inadequada": conduta que não trata o caso, é contraindicada, ou pode causar dano.

REGRA CRÍTICA — NÃO REVELE O DIAGNÓSTICO: use o diagnóstico verdadeiro APENAS internamente para classificar. É PROIBIDO nomear, citar ou insinuar o diagnóstico/doença. Esta resposta alimenta a evolução clínica do sistema, não é mostrada ao aluno.

Responda APENAS com JSON válido:
{ "adequacy": "adequada" | "parcial" | "inadequada" }`
}

export function parseConductAdequacy(raw: string): Adequacy | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }
  const a = obj.adequacy
  return a === 'adequada' || a === 'parcial' || a === 'inadequada' ? a : null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/prescriptions/conduct-eval.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/conduct-eval.ts src/lib/prescriptions/conduct-eval.test.ts
git commit -m "feat(conduta): juiz de conduta global (buildConductEvalPrompt + parse)"
```

---

## Task 4: Rota POST aceita `kind` + eval por item ciente do tipo

**Files:**
- Modify: `src/lib/prescriptions/prescription-prompts.ts`
- Create: `src/lib/prescriptions/prescription-prompts.test.ts`
- Modify: `src/app/api/consultations/[id]/prescriptions/route.ts`

**Interfaces:**
- Consumes: `ConductKind` de `./types`.
- Produces: `buildPrescriptionEvalPrompt(patient, drugName, posology, justification, caseSummary?, kind?)` — parâmetro `kind?: ConductKind` opcional (default `'medicamento'`, compatível com chamadas antigas).

- [ ] **Step 1: Escrever o teste que falha (prompt ciente do tipo)**

Create `src/lib/prescriptions/prescription-prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrescriptionEvalPrompt } from './prescription-prompts'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Celina', age: 60, specialty: 'Clínica Médica',
  chief_complaint: 'vômito com sangue', conditions: ['cirrose'],
  true_diagnosis: 'Hemorragia varicosa',
} as unknown as Patient

describe('buildPrescriptionEvalPrompt', () => {
  it('trata medicamento como prescrição de fármaco', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'terlipressina', '2mg 4/4h', null, null, 'medicamento')
    expect(p).toMatch(/medicamento|fármaco/i)
  })

  it('trata procedimento sem falar em posologia/dose', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'ligadura elástica', 'sessão inicial', null, null, 'procedimento')
    expect(p).toMatch(/procedimento/i)
    expect(p).toContain('ligadura elástica')
  })

  it('mantém a proibição de revelar o diagnóstico', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'terlipressina', '2mg', null, null, 'medicamento')
    expect(p).toMatch(/NÃO REVELE O DIAGNÓSTICO/i)
  })

  it('default sem kind = medicamento (compat)', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'losartana', '50mg/dia', null, null)
    expect(p).toMatch(/medicamento|fármaco/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts`
Expected: FAIL — `procedimento` não aparece (prompt ainda fixo em "Medicamento").

- [ ] **Step 3: Adaptar o prompt ao `kind`**

Modify `src/lib/prescriptions/prescription-prompts.ts` — trocar a assinatura e o corpo:

```typescript
import type { Patient } from '@/types/domain'
import type { ConductKind } from './types'

const ITEM_LABEL: Record<ConductKind, string> = {
  medicamento: 'Medicamento',
  procedimento: 'Procedimento',
  medida: 'Medida não-farmacológica',
}

export function buildPrescriptionEvalPrompt(
  patient: Patient,
  drugName: string,
  posology: string,
  justification: string | null,
  caseSummary?: string | null,
  kind: ConductKind = 'medicamento',
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const memory = caseSummary && caseSummary.trim() ? `\nMEMÓRIA DO CASO:\n${caseSummary}` : ''
  const isMed = kind === 'medicamento'
  const detailLabel = isMed ? 'Posologia' : 'Detalhamento'
  const focusLine = isMed
    ? 'O foco é a ESCOLHA do fármaco para o caso, não a casa decimal da dose.'
    : 'O foco é se o procedimento/medida é indicado e seguro para o caso.'

  return `Você é um supervisor clínico. Avalie a ADEQUAÇÃO de um item de conduta ao caso.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Diagnóstico verdadeiro do caso (contexto interno): ${trueDiag ?? '(não definido)'}${memory}

Item de conduta do aluno:
- Tipo: ${ITEM_LABEL[kind]}
- ${isMed ? 'Medicamento' : 'Item'}: ${drugName}
- ${detailLabel}: ${posology}
- Justificativa: ${justification ?? '(não informada)'}

Classifique a adequação em UMA das três faixas:
- "adequada": item apropriado para o diagnóstico/quadro.
- "parcial": escolha defensável mas com ressalva (segunda linha, indicação incompleta, falta algo importante).
- "inadequada": item sem indicação para o caso, contraindicado, ou que pode causar dano.

Considere a segurança (contraindicações óbvias para as condições do paciente). ${focusLine}

REGRA CRÍTICA — NÃO REVELE O DIAGNÓSTICO: use o diagnóstico verdadeiro APENAS internamente, para decidir a adequação. É PROIBIDO nomear, citar ou insinuar o diagnóstico verdadeiro (ou a entidade/doença específica) no campo "feedback". O aluno ainda está descobrindo o caso — revelar o diagnóstico estraga a simulação. Redija o feedback em termos do QUADRO/QUEIXA e da SEGURANÇA, NUNCA em termos da doença de base.

Responda APENAS com JSON válido:
{
  "adequacy": "adequada" | "parcial" | "inadequada",
  "feedback": "1-2 frases pedagógicas explicando a classificação"
}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Rota POST valida, avalia e grava `kind`**

Modify `src/app/api/consultations/[id]/prescriptions/route.ts`:

(a) `SELECT` (linha 9) — adicionar `kind`:

```typescript
const SELECT = 'id, consultation_id, drug_name, posology, kind, source, justification, adequacy, ai_feedback, status, created_at'
```

(b) Importar o tipo (linha 6, junto do import de `Adequacy`):

```typescript
import type { Adequacy, ConductKind } from '@/lib/prescriptions/types'
```

(c) Extração e validação do body (após linha 21 `const { drug_name, posology, justification, source } = ...`) — incluir `kind`:

```typescript
  const { drug_name, posology, justification, source, kind } = body as Record<string, unknown>
```

E, após a validação de `posology` (após a linha 29), adicionar:

```typescript
  const conductKind: ConductKind =
    kind === 'procedimento' || kind === 'medida' ? kind : 'medicamento'
```

(d) Passar `conductKind` ao eval (linha ~63):

```typescript
        content: buildPrescriptionEvalPrompt(patient, drug_name.trim(), posology.trim(), just, caseSummary, conductKind),
```

(e) Gravar `kind` no insert (bloco `.insert({ ... })`, após `posology`):

```typescript
      kind: conductKind,
```

- [ ] **Step 6: Verificar tsc + testes**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → sem saída.
Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/prescriptions/prescription-prompts.ts src/lib/prescriptions/prescription-prompts.test.ts "src/app/api/consultations/[id]/prescriptions/route.ts"
git commit -m "feat(conduta): rota e eval por item cientes do kind (medicamento/procedimento/medida)"
```

---

## Task 5: `TreatmentContext` com `kind` + `conductAdequacy` e a matriz de evolução

**Files:**
- Modify: `src/lib/consultations/prompts.ts`
- Create: `src/lib/consultations/prompts.test.ts`

**Interfaces:**
- Consumes: `Adequacy`, `ConductKind` de `@/lib/prescriptions/types`.
- Produces: `TreatmentContext` com `prescriptions: { drug_name; posology; adequacy: string | null; kind: ConductKind }[]`, `adherence: Adherence`, `conductAdequacy: Adequacy`. `buildFinishPrompt` e `buildCaseSummaryPrompt` usam a nova matriz.

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/consultations/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildFinishPrompt, type TreatmentContext } from './prompts'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Celina', age: 60, specialty: 'Clínica Médica',
  chief_complaint: 'vômito com sangue', clinical_status: 'sangramento ativo',
  true_diagnosis: 'Hemorragia varicosa',
} as unknown as Patient

function tx(conductAdequacy: TreatmentContext['conductAdequacy'], adherence: TreatmentContext['adherence']): TreatmentContext {
  return {
    prescriptions: [{ drug_name: 'terlipressina', posology: '2mg 4/4h', adequacy: 'parcial', kind: 'medicamento' }],
    adherence,
    conductAdequacy,
  }
}

describe('buildFinishPrompt — matriz de evolução', () => {
  it('conduta adequada nunca gera piora (regra dura no prompt)', () => {
    const p = buildFinishPrompt(patient, 'HDA por varizes', tx('adequada', 'baixa'))
    expect(p).toMatch(/adequada.*(nunca|jamais).*(piora|sem melhora)/is)
  })

  it('usa a nota GLOBAL da conduta, não a adequação por item', () => {
    const p = buildFinishPrompt(patient, 'raciocínio', tx('adequada', 'alta'))
    expect(p).toMatch(/conjunto|global/i)
    expect(p).toContain('adequada')
  })

  it('sem tratamento, mantém o ramo de heurística do pensamento clínico', () => {
    const p = buildFinishPrompt(patient, 'raciocínio', undefined)
    expect(p).toMatch(/pensamento clínico/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: FAIL — `conductAdequacy` não existe no tipo / matriz ausente.

- [ ] **Step 3: Atualizar `TreatmentContext` e a matriz**

Modify `src/lib/consultations/prompts.ts`:

(a) Import (após a linha 3 `import type { Adherence } ...`):

```typescript
import type { Adequacy, ConductKind } from '@/lib/prescriptions/types'
```

(b) Substituir a interface `TreatmentContext` (linhas 13–16):

```typescript
export interface TreatmentContext {
  prescriptions: { drug_name: string; posology: string; adequacy: string | null; kind: ConductKind }[]
  adherence: Adherence
  /** Nota GLOBAL do conjunto da conduta vs. diagnóstico (decide a evolução). */
  conductAdequacy: Adequacy
}
```

(c) Substituir o `treatmentSection` de `buildFinishPrompt` (linhas 218–225) pela matriz global:

```typescript
  const KIND_TAG: Record<ConductKind, string> = { medicamento: 'medicamento', procedimento: 'procedimento', medida: 'medida' }
  const treatmentSection = treatment && treatment.prescriptions.length > 0
    ? `\nCONDUTA ATIVA (do aluno):\n${treatment.prescriptions
        .map(p => `- [${KIND_TAG[p.kind]}] ${p.drug_name} — ${p.posology}`)
        .join('\n')}
Adequação GLOBAL do conjunto da conduta: ${treatment.conductAdequacy}
Adesão estimada (só afeta medicamentos de uso contínuo; procedimento executado não depende de adesão): ${treatment.adherence}

REGRA DO EFEITO DO TRATAMENTO (priorize sobre a heurística do pensamento clínico) — baseie-se na adequação GLOBAL do conjunto, não em itens isolados:
- Conjunto "adequada" + adesão alta ou média → MELHORA CLARA dos sintomas.
- Conjunto "adequada" + adesão baixa → MELHORA PARCIAL (a fala/estado pode trazer uma pista de má adesão a medicamentos).
- Conjunto "parcial" → melhora parcial, com sintomas residuais.
- Conjunto "inadequada" → persistência ou leve piora (efeito adverso possível se claramente danoso).
REGRA DURA: conduta "adequada" NUNCA gera "sem melhora" nem piora — no máximo melhora parcial.`
    : ''
```

- [ ] **Step 4: Atualizar o `buildCaseSummaryPrompt` para o mesmo modelo**

Ainda em `src/lib/consultations/prompts.ts`, no `buildCaseSummaryPrompt`, o bloco de prescrições (linhas 86–88 e 107–109) — trocar para incluir `kind` e a nota global. Substituir:

```typescript
  const prescriptionsBlock = treatment && treatment.prescriptions.length > 0
    ? treatment.prescriptions.map(p => `- [${p.kind}] ${p.drug_name}: ${p.posology}`).join('\n')
    : null
```

E o trecho do template (onde hoje está "CONSULTA ATUAL — prescrições do aluno" + "Adesão estimada") passa a:

```typescript
CONSULTA ATUAL — conduta do aluno:
${prescriptionsBlock ?? '(nenhuma conduta registrada)'}
Adequação global da conduta: ${treatment ? treatment.conductAdequacy : '(não avaliada)'}
Adesão estimada do paciente: ${treatment ? treatment.adherence : '(não avaliada)'}
```

E na seção `Evolução:` do template, trocar a dica para refletir a matriz:

```
Evolução: <linha do tempo curta, uma linha por consulta; use a adequação GLOBAL da conduta e a adesão — conduta adequada nunca piora (no máximo melhora parcial se adesão baixa); conduta inadequada/ausente persiste ou piora>
```

- [ ] **Step 5: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/consultations/prompts.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → sem saída.

> Nota: este passo quebra a compilação de `finish/route.ts` (que ainda monta `TreatmentContext` sem `conductAdequacy`/`kind`). Isso é resolvido na Task 6; se rodar `tsc` no projeto inteiro aqui, o erro de `finish/route.ts` é esperado. Rode o `tsc` completo só ao fim da Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/consultations/prompts.ts src/lib/consultations/prompts.test.ts
git commit -m "feat(conduta): TreatmentContext com kind + conductAdequacy e matriz de evolução"
```

---

## Task 6: `finish/route.ts` — juiz de conduta global + evolução do vínculo

**Files:**
- Modify: `src/app/api/consultations/[id]/finish/route.ts`

**Interfaces:**
- Consumes: `buildConductEvalPrompt`, `parseConductAdequacy`, `type ConductItem` de `@/lib/prescriptions/conduct-eval`; `nextBondLevel` de `@/lib/prescriptions/adherence`; `TreatmentContext` (agora com `kind` + `conductAdequacy`).

- [ ] **Step 1: Imports**

Modify `src/app/api/consultations/[id]/finish/route.ts` — trocar a linha 8:

```typescript
import { estimateAdherence, nextBondLevel } from '@/lib/prescriptions/adherence'
import { buildConductEvalPrompt, parseConductAdequacy, type ConductItem } from '@/lib/prescriptions/conduct-eval'
```

- [ ] **Step 2: Buscar `kind`, avaliar a conduta global e montar o `TreatmentContext`**

Substituir o bloco de montagem do `treatment` (linhas 64–86) por:

```typescript
  let treatment: TreatmentContext | undefined
  try {
    const { data: rxRows } = await supabase
      .from('prescriptions')
      .select('drug_name, posology, adequacy, kind')
      .eq('patient_id', patient.id as string)
      .eq('user_id', user.id)
      .eq('status', 'active')
    if (rxRows && rxRows.length > 0) {
      const bond = (patient as Record<string, unknown>).bond_level as number ?? 3
      const personality = (patient as Record<string, unknown>).personality as string | null
      const conduct: ConductItem[] = rxRows.map(r => ({
        drug_name: r.drug_name as string,
        posology: r.posology as string,
        kind: (r.kind as ConductItem['kind']) ?? 'medicamento',
      }))
      // Juiz de conduta GLOBAL (best-effort). Falha → 'parcial' (nunca pune o acerto por erro técnico).
      let conductAdequacy: import('@/lib/prescriptions/types').Adequacy = 'parcial'
      try {
        const evalC = await openai.chat.completions.create({
          model: MODELS.utility,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: buildConductEvalPrompt(patient as never, conduct) }],
        }, { timeout: 25_000 })
        const parsed = parseConductAdequacy(evalC.choices[0]?.message?.content ?? '')
        if (parsed) conductAdequacy = parsed
      } catch {
        // best-effort — mantém 'parcial'
      }
      treatment = {
        prescriptions: rxRows.map(r => ({
          drug_name: r.drug_name as string,
          posology: r.posology as string,
          adequacy: (r.adequacy as string | null) ?? null,
          kind: (r.kind as ConductItem['kind']) ?? 'medicamento',
        })),
        adherence: estimateAdherence(bond, personality),
        conductAdequacy,
      }
    }
  } catch {
    // best-effort — segue sem efeito de tratamento
  }
```

- [ ] **Step 3: Atualizar `bond_level` no fim (após o AB4)**

No fim do handler, imediatamente antes do `return NextResponse.json(...)` final (linha 291), inserir:

```typescript
  // Evolução do vínculo (best-effort): +1 por consulta, modulado pela nota A2 (Retórico)
  // desta consulta. Toma efeito na PRÓXIMA consulta (a adesão de hoje usou o vínculo antigo).
  try {
    const currentBond = (patient as Record<string, unknown>).bond_level as number ?? 1
    const a2 = ab4 && typeof ab4.a2 === 'number' ? ab4.a2 : null
    const newBond = nextBondLevel(currentBond, a2)
    if (newBond !== currentBond) {
      await supabase
        .from('patients')
        .update({ bond_level: newBond })
        .eq('id', patient.id as string)
        .eq('user_id', user.id)
    }
  } catch {
    // best-effort — vínculo não evolui se algo falhar
  }
```

> Observação de ordenação (não é passo): o `TreatmentContext` (Step 2) usa o `bond_level` que o paciente tinha AO ENTRAR na consulta — correto. O incremento acima só vale para a próxima. Em consulta de seguimento (`isFollowUp`), `ab4` é `null` → `a2` null → `+1` puro; aceitável.

- [ ] **Step 4: Verificar tsc + suíte inteira**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → sem saída (agora `finish/route.ts` compila com o novo `TreatmentContext`).
Run: `npx vitest run` → todos verdes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/consultations/[id]/finish/route.ts"
git commit -m "feat(conduta): finish avalia conduta global e evolui o bond_level pelo A2"
```

---

## Task 7: UI — painel "Conduta" com seletor de tipo

**Files:**
- Modify: `src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx`

**Interfaces:**
- Consumes: `ConductKind` de `@/lib/prescriptions/types`.

- [ ] **Step 1: Estado do tipo + envio do `kind`**

Modify `PrescriptionPanel.tsx`:

(a) Import (linha 5, junto de `Prescription`):

```typescript
import type { Prescription, ConductKind } from '@/lib/prescriptions/types'
```

(b) Novo estado (após a linha 24 `const [source, setSource] = ...`):

```typescript
  const [kind, setKind] = useState<ConductKind>('medicamento')
```

(c) No `prescribe()`, incluir `kind` no body (linha ~44):

```typescript
        body: JSON.stringify({ drug_name: drug.trim(), posology: posology.trim(), justification: justification.trim() || undefined, source, kind }),
```

(d) Reset após sucesso (linha ~49) — voltar o tipo ao padrão:

```typescript
      setDrug(''); setPosology(''); setJustification(''); setSource('free'); setKind('medicamento')
```

- [ ] **Step 2: Seletor de tipo + labels dependentes do tipo**

Ainda no JSX do formulário, logo antes do input de medicamento (antes da linha 76 `<div className="relative">`), adicionar o seletor:

```tsx
        <div className="flex gap-1">
          {(['medicamento', 'procedimento', 'medida'] as ConductKind[]).map(k => (
            <button key={k} type="button"
              onClick={() => setKind(k)}
              className={`text-xs px-2 py-1 rounded-md capitalize ${kind === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {k}
            </button>
          ))}
        </div>
```

E ajustar os placeholders para refletir o tipo. Trocar o `placeholder` do input de medicamento (linha 81):

```tsx
            placeholder={kind === 'medicamento' ? 'Medicamento...' : kind === 'procedimento' ? 'Procedimento...' : 'Medida...'}
```

E o do input de posologia (linha 101):

```tsx
          placeholder={kind === 'medicamento' ? 'Posologia (dose, via, frequência, duração)...' : 'Detalhamento...'}
```

Ocultar o autocomplete de catálogo quando não for medicamento — trocar a condição de exibição das sugestões (linha 85) de `{showSug && suggestions.length > 0 && (` para:

```tsx
          {kind === 'medicamento' && showSug && suggestions.length > 0 && (
```

- [ ] **Step 3: Exibir o tipo em cada item da lista**

No render de cada `rx` (após a linha 123, dentro do `<span>` do nome ou logo abaixo), adicionar um marcador do tipo. Trocar o `<span>` do nome (linhas 122–124) por:

```tsx
                <span className="text-xs font-medium text-gray-800">
                  {rx.kind !== 'medicamento' && <span className="text-gray-400 mr-1">[{rx.kind}]</span>}
                  {rx.drug_name}{rx.status === 'suspended' && ' (suspenso)'}
                </span>
```

- [ ] **Step 4: Título "Conduta" e verificação visual**

Confirmar que a coluna 2 da consulta rotula o painel como "Conduta". Localizar o título do painel (onde `PrescriptionPanel` é renderizado / cabeçalho da coluna) e, se houver rótulo "Prescrições"/"Prescrição", trocar para "Conduta".

Run: `grep -rn "Prescriç" "src/app/(dashboard)/consultations/[id]/"` para achar o rótulo do cabeçalho e ajustá-lo.

- [ ] **Step 5: tsc + build check**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → sem saída.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx"
git commit -m "feat(conduta): painel Conduta com seletor de tipo (medicamento/procedimento/medida)"
```

---

## Task 8: Modo leitura exibe o tipo da conduta

**Files:**
- Modify: `src/app/(dashboard)/consultations/[id]/page.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx`

- [ ] **Step 1: Incluir `kind` no select do modo leitura**

Modify `src/app/(dashboard)/consultations/[id]/page.tsx` (linha 35):

```typescript
      .select('id, drug_name, posology, kind, adequacy, ai_feedback, status')
```

- [ ] **Step 2: Tipo e render no ConsultationReadOnly**

Modify `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx`:

(a) `PrescriptionRow` (após linha 17 `posology: string`):

```typescript
  kind?: string
```

(b) Título da seção (linha 228) — de `Prescrições` para `Conduta`:

```tsx
        <Section title="Conduta">
```

(c) No nome do item (linha 237–240), prefixar o tipo quando não for medicamento:

```tsx
                        <p className="text-sm font-medium text-gray-800">
                          {rx.kind && rx.kind !== 'medicamento' && <span className="text-gray-400 font-normal">[{rx.kind}] </span>}
                          {rx.drug_name}
                          {rx.status === 'suspended' && <span className="text-gray-400 font-normal"> (suspenso)</span>}
                        </p>
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → sem saída.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/page.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx"
git commit -m "feat(conduta): modo leitura mostra o tipo de cada item da conduta"
```

---

## Task 9: Regenerar `database.ts`, verificação final e validação em modelo real

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerar os tipos do banco**

Regenerar via Supabase MCP `mcp__plugin_supabase_supabase__generate_typescript_types` (projeto `zrgjsgorijqlqhvlrpdh`) e substituir `src/types/database.ts`. Conferir que a linha 1 não veio com "Initialising login role..." (se vier, remover). Confirmar que `prescriptions.Row` agora tem `kind: string`.

- [ ] **Step 2: Verificação completa**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → sem saída.
Run: `npx vitest run` → todos verdes (26+ arquivos).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(conduta): regenera database.ts com a coluna kind"
```

- [ ] **Step 4: Validação em modelo real (manual, após deploy)**

Após redeploy manual no Easypanel:
1. **Caso Celina-like** (hemorragia varicosa): registrar terlipressina (medicamento) + ligadura elástica (procedimento) + TIPS (procedimento); finalizar; iniciar consulta de seguimento e perguntar sobre melhora. Esperado: paciente relata **melhora** (não "leve piora").
2. **Contraprova** (conduta inadequada): registrar um fármaco sem indicação; finalizar; seguimento. Esperado: **persistência/piora**.
3. **Vínculo**: após uma consulta com boa condução (A2 alto), conferir no banco que `bond_level` subiu (`SELECT bond_level FROM patients WHERE id=...`) e que a `BondBar` reflete na tela.

> Eficácia dos prompts é probabilística (gpt-4.1-mini); os testes garantem a INSTRUÇÃO no prompt, não o comportamento do modelo.

---

## Self-Review (do autor do plano)

- **Cobertura do spec:** Parte 1 (kind + painel Conduta + eval por item) → Tasks 1, 4, 7, 8. Parte 2(a) vínculo → Task 2 + Task 6 Step 3. Parte 2(b) juiz global → Task 3 + Task 6 Step 2. Parte 2(c) matriz → Task 5. Regeneração de tipos → Task 9. Migration antes do deploy → Task 1 Step 2 + Global Constraints. ✅
- **Desvio consciente do spec:** o juiz global devolve `Adequacy` (`adequada|parcial|inadequada`), não incluindo `'ausente'`; "ausente" é representado por `treatment === undefined` (nenhuma conduta ativa → ramo de heurística já existente em `buildFinishPrompt`). Falha técnica do juiz degrada para `'parcial'` (não `'ausente'`), fiel ao princípio "nunca punir o acerto por erro técnico". Registrado aqui e na memória.
- **Consistência de tipos:** `ConductKind` definido na Task 1 e consumido igual em 3,4,5,7,8; `nextBondLevel(current, a2)` definido na Task 2 e chamado na Task 6; `TreatmentContext.conductAdequacy: Adequacy` definido na Task 5 e populado na Task 6. ✅
- **Placeholders:** nenhum — todo passo com código tem o código completo. ✅
