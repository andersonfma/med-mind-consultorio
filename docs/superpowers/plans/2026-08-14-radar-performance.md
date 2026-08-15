# Radar de Performance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir no dashboard um radar (gráfico "em teia") de 3 eixos — Pensamento Clínico (AB4), Comunicação e Técnica — agregando os scores que o simulador já produz para o aluno.

**Architecture:** Lógica de agregação e cálculo 100% pura em `src/lib/performance/radar.ts` (testável isolada). Um loader server-only consulta as 4 tabelas do aluno (todas têm `user_id`) e chama a lógica pura. Um componente client desenha o polígono em SVG próprio. O Server Component do dashboard chama o loader e passa o resultado como prop. Nenhuma migration, nenhuma dependência nova, nenhuma chamada de IA.

**Tech Stack:** Next.js 16 (App Router, RSC), Supabase (client tipado), Vitest + Testing Library, Tailwind, SVG manual.

## Global Constraints

- **Sem migration** — todos os sinais já existem: `consultations.ab4_score` (JSONB), `consultations.communication_score` (JSONB), `patients.diagnosis_status`, `exam_requests.status`, `prescriptions.adequacy`.
- **Sem dependência nova** — radar desenhado em SVG à mão (sem lib de chart), coerente com o projeto.
- **Determinístico** — sem `openai`, sem timeout, sem best-effort. Puramente cálculo.
- **Eixo/submétrica sem dado = `null` ("sem dados"), NUNCA 0** — zero puniria o aluno por ainda não ter gerado aquele sinal. "Vazio" é detectado pela sentinela de recomendação já existente (`EMPTY_REASONING_RECOMMENDATION`, `EMPTY_COMMUNICATION_RECOMMENDATION`).
- **Server Component NUNCA passa função como prop** para Client Component (padrão do projeto).
- **tsc check:** `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` (validator.ts tem erros pré-existentes do Next).
- **App é light-only** — seguir o estilo claro dos cards existentes (`PlaceholderChart`, dashboard). Não introduzir dark mode.
- Rodar testes com `npx vitest run <arquivo>`.

---

## File Structure

- `src/lib/performance/radar.ts` (CREATE) — tipos + lógica pura: `buildRadarInput`, `computeRadar`, `radarFromRows`.
- `src/lib/performance/radar.test.ts` (CREATE) — testes da lógica pura.
- `src/lib/performance/loader.ts` (CREATE) — `getRadarData(supabase, userId)` server-only.
- `src/lib/performance/loader.test.ts` (CREATE) — teste do loader com Supabase mockado.
- `src/app/(dashboard)/dashboard/PerformanceRadar.tsx` (CREATE) — componente client (SVG).
- `src/app/(dashboard)/dashboard/PerformanceRadar.test.tsx` (CREATE) — testes dos 3 estados.
- `src/app/(dashboard)/dashboard/page.tsx` (MODIFY) — chama o loader e renderiza o radar no lugar do placeholder "Desempenho AB4".

---

## Task 1: Lógica pura do radar (`radar.ts`)

**Files:**
- Create: `src/lib/performance/radar.ts`
- Test: `src/lib/performance/radar.test.ts`

**Interfaces:**
- Consumes: `EMPTY_REASONING_RECOMMENDATION` de `@/lib/consultations/ab4`, `EMPTY_COMMUNICATION_RECOMMENDATION` de `@/lib/consultations/communication`.
- Produces:
  - `interface RadarResult { pensamentoClinico: number|null; comunicacao: number|null; tecnica: number|null; n: number }`
  - `interface RawConsultationRow { ab4_score: unknown; communication_score: unknown; status: string }`
  - `interface RawPatientRow { diagnosis_status: string }`
  - `interface RawExamRow { status: string }`
  - `interface RawPrescriptionRow { adequacy: string|null }`
  - `interface RadarRows { consultations: RawConsultationRow[]; patients: RawPatientRow[]; exams: RawExamRow[]; prescriptions: RawPrescriptionRow[] }`
  - `interface RadarInput { ab4Overalls: number[]; communicationOveralls: number[]; diagnoses: Array<'achieved'|'revealed'>; examDecisions: Array<'approved'|'rejected'>; conductAdequacies: Array<'adequada'|'parcial'|'inadequada'>; n: number }`
  - `function buildRadarInput(rows: RadarRows): RadarInput`
  - `function computeRadar(input: RadarInput): RadarResult`
  - `function radarFromRows(rows: RadarRows): RadarResult`

- [ ] **Step 1: Write the failing test**

Create `src/lib/performance/radar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildRadarInput, computeRadar, radarFromRows } from './radar'
import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

const ab4 = (overall: number, recommendation = 'ok') => ({ overall, recommendation })
const comm = (overall: number, recommendation = 'ok') => ({ overall, recommendation })

describe('buildRadarInput', () => {
  it('coleta overalls de AB4 e comunicação só de consultas finished', () => {
    const input = buildRadarInput({
      consultations: [
        { ab4_score: ab4(8), communication_score: comm(6), status: 'finished' },
        { ab4_score: ab4(4), communication_score: comm(4), status: 'active' }, // ignorada
      ],
      patients: [], exams: [], prescriptions: [],
    })
    expect(input.ab4Overalls).toEqual([8])
    expect(input.communicationOveralls).toEqual([6])
    expect(input.n).toBe(1)
  })

  it('trata score "vazio" (sentinela) como NÃO medido (não entra, não vira 0)', () => {
    const input = buildRadarInput({
      consultations: [
        { ab4_score: ab4(0, EMPTY_REASONING_RECOMMENDATION), communication_score: comm(0, EMPTY_COMMUNICATION_RECOMMENDATION), status: 'finished' },
      ],
      patients: [], exams: [], prescriptions: [],
    })
    expect(input.ab4Overalls).toEqual([])
    expect(input.communicationOveralls).toEqual([])
    expect(input.n).toBe(1)
  })

  it('ignora ab4_score null (seguimento) mas mantém comunicação', () => {
    const input = buildRadarInput({
      consultations: [
        { ab4_score: null, communication_score: comm(7), status: 'finished' },
      ],
      patients: [], exams: [], prescriptions: [],
    })
    expect(input.ab4Overalls).toEqual([])
    expect(input.communicationOveralls).toEqual([7])
  })

  it('filtra diagnósticos fechados, exames decididos e condutas avaliadas', () => {
    const input = buildRadarInput({
      consultations: [],
      patients: [{ diagnosis_status: 'achieved' }, { diagnosis_status: 'revealed' }, { diagnosis_status: 'none' }],
      exams: [{ status: 'approved' }, { status: 'rejected' }, { status: 'pending' }],
      prescriptions: [{ adequacy: 'adequada' }, { adequacy: 'parcial' }, { adequacy: null }],
    })
    expect(input.diagnoses).toEqual(['achieved', 'revealed'])
    expect(input.examDecisions).toEqual(['approved', 'rejected'])
    expect(input.conductAdequacies).toEqual(['adequada', 'parcial'])
  })
})

describe('computeRadar', () => {
  const empty = { ab4Overalls: [], communicationOveralls: [], diagnoses: [], examDecisions: [], conductAdequacies: [], n: 0 } as const

  it('médias dos três eixos quando há dado', () => {
    const r = computeRadar({
      ab4Overalls: [8, 6], communicationOveralls: [7], n: 2,
      diagnoses: ['achieved', 'revealed'],      // 1/2 → 5
      examDecisions: ['approved', 'approved', 'rejected'], // 2/3 → 6.67
      conductAdequacies: ['adequada', 'parcial'], // (10+5)/2 → 7.5
    })
    expect(r.pensamentoClinico).toBe(7)
    expect(r.comunicacao).toBe(7)
    // técnica = média(5, 6.7, 7.5) = 6.4
    expect(r.tecnica).toBe(6.4)
    expect(r.n).toBe(2)
  })

  it('técnica usa só as submétricas presentes (omite as vazias)', () => {
    const r = computeRadar({ ...empty, diagnoses: ['achieved'], n: 1 }) // só acurácia = 10
    expect(r.tecnica).toBe(10)
  })

  it('eixo sem dado → null (nunca 0)', () => {
    const r = computeRadar(empty)
    expect(r.pensamentoClinico).toBeNull()
    expect(r.comunicacao).toBeNull()
    expect(r.tecnica).toBeNull()
    expect(r.n).toBe(0)
  })

  it('radarFromRows integra build + compute', () => {
    const r = radarFromRows({
      consultations: [{ ab4_score: ab4(8), communication_score: comm(6), status: 'finished' }],
      patients: [{ diagnosis_status: 'achieved' }],
      exams: [], prescriptions: [],
    })
    expect(r).toEqual({ pensamentoClinico: 8, comunicacao: 6, tecnica: 10, n: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/performance/radar.test.ts`
Expected: FAIL ("Failed to resolve import './radar'" / funções indefinidas).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/performance/radar.ts`:

```ts
import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

export interface RadarResult {
  pensamentoClinico: number | null
  comunicacao: number | null
  tecnica: number | null
  n: number
}

// Linhas cruas (só os campos usados) — espelham o schema.
export interface RawConsultationRow { ab4_score: unknown; communication_score: unknown; status: string }
export interface RawPatientRow { diagnosis_status: string }
export interface RawExamRow { status: string }
export interface RawPrescriptionRow { adequacy: string | null }

export interface RadarRows {
  consultations: RawConsultationRow[]
  patients: RawPatientRow[]
  exams: RawExamRow[]
  prescriptions: RawPrescriptionRow[]
}

export interface RadarInput {
  ab4Overalls: number[]
  communicationOveralls: number[]
  diagnoses: Array<'achieved' | 'revealed'>
  examDecisions: Array<'approved' | 'rejected'>
  conductAdequacies: Array<'adequada' | 'parcial' | 'inadequada'>
  n: number
}

const clamp = (v: number) => Math.max(0, Math.min(10, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// Extrai `overall` de um score JSONB, tratando o resultado "vazio" (detectado pela
// sentinela de recomendação) como NÃO MEDIDO (null) — nunca como 0.
function extractOverall(score: unknown, emptyRecommendation: string): number | null {
  if (!score || typeof score !== 'object') return null
  const obj = score as Record<string, unknown>
  if (obj.recommendation === emptyRecommendation) return null
  const overall = obj.overall
  return typeof overall === 'number' && !Number.isNaN(overall) ? clamp(overall) : null
}

export function buildRadarInput(rows: RadarRows): RadarInput {
  const ab4Overalls: number[] = []
  const communicationOveralls: number[] = []
  let n = 0
  for (const c of rows.consultations) {
    if (c.status !== 'finished') continue
    n++
    const a = extractOverall(c.ab4_score, EMPTY_REASONING_RECOMMENDATION)
    if (a !== null) ab4Overalls.push(a)
    const k = extractOverall(c.communication_score, EMPTY_COMMUNICATION_RECOMMENDATION)
    if (k !== null) communicationOveralls.push(k)
  }
  const diagnoses = rows.patients
    .map(p => p.diagnosis_status)
    .filter((s): s is 'achieved' | 'revealed' => s === 'achieved' || s === 'revealed')
  const examDecisions = rows.exams
    .map(e => e.status)
    .filter((s): s is 'approved' | 'rejected' => s === 'approved' || s === 'rejected')
  const conductAdequacies = rows.prescriptions
    .map(p => p.adequacy)
    .filter((s): s is 'adequada' | 'parcial' | 'inadequada' =>
      s === 'adequada' || s === 'parcial' || s === 'inadequada')
  return { ab4Overalls, communicationOveralls, diagnoses, examDecisions, conductAdequacies, n }
}

const ADEQUACY_SCORE: Record<'adequada' | 'parcial' | 'inadequada', number> = {
  adequada: 10, parcial: 5, inadequada: 0,
}

export function computeRadar(input: RadarInput): RadarResult {
  const pensamentoClinico = input.ab4Overalls.length ? round1(mean(input.ab4Overalls)) : null
  const comunicacao = input.communicationOveralls.length ? round1(mean(input.communicationOveralls)) : null

  const tecnicaParts: number[] = []
  if (input.diagnoses.length)
    tecnicaParts.push(10 * input.diagnoses.filter(d => d === 'achieved').length / input.diagnoses.length)
  if (input.examDecisions.length)
    tecnicaParts.push(10 * input.examDecisions.filter(e => e === 'approved').length / input.examDecisions.length)
  if (input.conductAdequacies.length)
    tecnicaParts.push(mean(input.conductAdequacies.map(a => ADEQUACY_SCORE[a])))
  const tecnica = tecnicaParts.length ? round1(mean(tecnicaParts)) : null

  return { pensamentoClinico, comunicacao, tecnica, n: input.n }
}

export function radarFromRows(rows: RadarRows): RadarResult {
  return computeRadar(buildRadarInput(rows))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/performance/radar.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/performance/radar.ts src/lib/performance/radar.test.ts
git commit -m "feat(radar): lógica pura de agregação dos 3 eixos (AB4, comunicação, técnica)"
```

---

## Task 2: Loader server-side (`loader.ts`)

**Files:**
- Create: `src/lib/performance/loader.ts`
- Test: `src/lib/performance/loader.test.ts`

**Interfaces:**
- Consumes: `radarFromRows`, `RadarResult` de `./radar`; `SupabaseClient<Database>` (tipos).
- Produces: `function getRadarData(supabase: SupabaseClient<Database>, userId: string): Promise<RadarResult>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/performance/loader.test.ts`:

```ts
// @vitest-environment node
import { vi, describe, it, expect } from 'vitest'

vi.mock('server-only', () => ({}))

import { getRadarData } from './loader'

// Mock ciente da tabela: cada .from(t).select().eq() resolve com as linhas daquela tabela.
function mockSupabase(rowsByTable: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rowsByTable[table] ?? [], error: null }),
      }),
    }),
  } as unknown as Parameters<typeof getRadarData>[0]
}

describe('getRadarData', () => {
  it('agrega as 4 tabelas do aluno e devolve o RadarResult calculado', async () => {
    const supabase = mockSupabase({
      consultations: [{ ab4_score: { overall: 8, recommendation: 'ok' }, communication_score: { overall: 6, recommendation: 'ok' }, status: 'finished' }],
      patients: [{ diagnosis_status: 'achieved' }],
      exam_requests: [{ status: 'approved' }],
      prescriptions: [{ adequacy: 'adequada' }],
    })
    const result = await getRadarData(supabase, 'user-1')
    expect(result).toEqual({ pensamentoClinico: 8, comunicacao: 6, tecnica: 10, n: 1 })
  })

  it('sem dados → todos os eixos null e n 0', async () => {
    const supabase = mockSupabase({})
    const result = await getRadarData(supabase, 'user-1')
    expect(result).toEqual({ pensamentoClinico: null, comunicacao: null, tecnica: null, n: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/performance/loader.test.ts`
Expected: FAIL ("Failed to resolve import './loader'").

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/performance/loader.ts`:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { radarFromRows, type RadarResult } from './radar'

/**
 * Agrega os scores do aluno (todas as tabelas têm user_id → filtro direto, RLS-backed)
 * e devolve o RadarResult. Determinístico, sem IA.
 */
export async function getRadarData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RadarResult> {
  const [consultations, patients, exams, prescriptions] = await Promise.all([
    supabase.from('consultations').select('ab4_score, communication_score, status').eq('user_id', userId),
    supabase.from('patients').select('diagnosis_status').eq('user_id', userId),
    supabase.from('exam_requests').select('status').eq('user_id', userId),
    supabase.from('prescriptions').select('adequacy').eq('user_id', userId),
  ])
  return radarFromRows({
    consultations: consultations.data ?? [],
    patients: patients.data ?? [],
    exams: exams.data ?? [],
    prescriptions: prescriptions.data ?? [],
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/performance/loader.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem novos erros (a saída de `.select()` é estruturalmente compatível com `RadarRows`; `Json | null` é atribuível a `unknown`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/performance/loader.ts src/lib/performance/loader.test.ts
git commit -m "feat(radar): loader server-side agrega scores do aluno"
```

---

## Task 3: Componente do radar (`PerformanceRadar.tsx`)

**Files:**
- Create: `src/app/(dashboard)/dashboard/PerformanceRadar.tsx`
- Test: `src/app/(dashboard)/dashboard/PerformanceRadar.test.tsx`

**Interfaces:**
- Consumes: `RadarResult` de `@/lib/performance/radar`.
- Produces: `function PerformanceRadar({ result }: { result: RadarResult }): JSX.Element` (client component, default export não; named export `PerformanceRadar`).

- [ ] **Step 1: Write the failing test**

Create `src/app/(dashboard)/dashboard/PerformanceRadar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerformanceRadar } from './PerformanceRadar'

describe('PerformanceRadar', () => {
  it('estado vazio: sem dados/n 0 mostra CTA', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: null, comunicacao: null, tecnica: null, n: 0 }} />)
    expect(screen.getByText(/Faça consultas/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/patients/new')
  })

  it('estado parcial: eixo null aparece como "sem dados"', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: null, tecnica: 6, n: 3 }} />)
    expect(screen.getByText(/sem dados/i)).toBeInTheDocument()
    expect(screen.getByText(/baseado em 3 consultas/i)).toBeInTheDocument()
  })

  it('estado cheio: mostra os três valores', () => {
    render(<PerformanceRadar result={{ pensamentoClinico: 8, comunicacao: 7, tecnica: 6, n: 5 }} />)
    expect(screen.getByLabelText(/Radar de performance/i)).toBeInTheDocument()
    expect(screen.getByText(/baseado em 5 consultas/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(dashboard)/dashboard/PerformanceRadar.test.tsx"`
Expected: FAIL ("Failed to resolve import './PerformanceRadar'").

- [ ] **Step 3: Write minimal implementation**

Create `src/app/(dashboard)/dashboard/PerformanceRadar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import type { RadarResult } from '@/lib/performance/radar'

const AXES = [
  { key: 'pensamentoClinico', label: 'Pensamento Clínico', angle: -90 },
  { key: 'tecnica', label: 'Técnica', angle: 30 },
  { key: 'comunicacao', label: 'Comunicação', angle: 150 },
] as const

const SIZE = 220, CENTER = SIZE / 2, R = 78

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) }
}

export function PerformanceRadar({ result }: { result: RadarResult }) {
  const values = AXES.map(ax => result[ax.key])
  const hasAny = values.some(v => v !== null)

  if (!hasAny || result.n === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Radar de performance</h3>
        <p className="text-xs text-gray-400 mb-3">Faça consultas para ver seu radar de performance.</p>
        <Link href="/patients/new" className="text-xs text-blue-600 hover:underline">Adicionar paciente</Link>
      </div>
    )
  }

  const polygon = AXES.map((ax, i) => {
    const p = point(ax.angle, ((values[i] ?? 0) / 10) * R)
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Radar de performance</h3>
        <span className="text-xs text-gray-400">baseado em {result.n} consulta{result.n === 1 ? '' : 's'}</span>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-56" role="img" aria-label="Radar de performance">
        {[2, 4, 6, 8, 10].map(ring => (
          <polygon key={ring}
            points={AXES.map(ax => { const p = point(ax.angle, (ring / 10) * R); return `${p.x},${p.y}` }).join(' ')}
            fill="none" stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {AXES.map((ax, i) => {
          const edge = point(ax.angle, R)
          const labelP = point(ax.angle, R + 20)
          const isNull = values[i] === null
          return (
            <g key={ax.key}>
              <line x1={CENTER} y1={CENTER} x2={edge.x} y2={edge.y}
                stroke="#e5e7eb" strokeWidth="1" strokeDasharray={isNull ? '3 3' : undefined} />
              <text x={labelP.x} y={labelP.y} textAnchor="middle" dominantBaseline="middle"
                fill={isNull ? '#d1d5db' : '#4b5563'} style={{ fontSize: 9 }}>
                {isNull ? `${ax.label} (sem dados)` : `${ax.label} ${values[i]}`}
              </text>
            </g>
          )
        })}
        <polygon points={polygon} fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="2" />
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(dashboard)/dashboard/PerformanceRadar.test.tsx"`
Expected: PASS (3 estados).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/PerformanceRadar.tsx" "src/app/(dashboard)/dashboard/PerformanceRadar.test.tsx"
git commit -m "feat(radar): componente SVG do radar (vazio/parcial/cheio)"
```

---

## Task 4: Integrar no dashboard (`page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getRadarData` de `@/lib/performance/loader`; `PerformanceRadar` de `./PerformanceRadar`.
- Produces: nada (página).

- [ ] **Step 1: Editar a página**

Em `src/app/(dashboard)/dashboard/page.tsx`:

1. Adicionar imports no topo:
```tsx
import { getRadarData } from '@/lib/performance/loader'
import { PerformanceRadar } from './PerformanceRadar'
```

2. Buscar o radar junto do resto (o `user` já existe acima). Logo após o bloco `Promise.all([...])` existente que carrega `patientsResult`/`profileResult`, adicionar:
```tsx
const radar = await getRadarData(supabase, user.id)
```

3. Substituir a primeira linha da coluna direita — trocar
```tsx
<PlaceholderChart title="Desempenho AB4" description="Eixos A1–A4 do método AB4" />
```
por
```tsx
<PerformanceRadar result={radar} />
```
Manter os outros dois `PlaceholderChart` (Reputação, Volume de atendimentos). Se o import de `PlaceholderChart` ficar sem uso, mantê-lo (ainda é usado pelos outros dois).

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem novos erros.
Run: `npx eslint "src/app/(dashboard)/dashboard/page.tsx" src/lib/performance`
Expected: limpo.

- [ ] **Step 3: Rodar a suíte inteira (nada regrediu)**

Run: `npx vitest run`
Expected: PASS em tudo (as 2 falhas conhecidas de `specialties.test.ts` que batem no Supabase live podem ocorrer isoladas — não relacionadas a este trabalho).

- [ ] **Step 4: Build de produção (o radar entra num Server Component)**

Run: `npm run build`
Expected: build conclui sem erro na rota `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(radar): exibe o radar de performance no dashboard"
```

---

## Self-Review (feito na escrita)

- **Spec coverage:** 3 eixos (Task 1), regra "null nunca 0" via sentinela (Task 1, `extractOverall`), determinístico/sem migration (constraints), loader agregando as 4 tabelas por `user_id` (Task 2), UI 3 estados vazio/parcial/cheio (Task 3), placement no dashboard substituindo o placeholder AB4 (Task 4), testes de cada camada. Fora de escopo (evolução no tempo, por-paciente, eixo Gestão) não vira tarefa. ✔
- **Placeholder scan:** todo passo tem código real. ✔
- **Type consistency:** `RadarResult`/`RadarRows`/`RadarInput` e `radarFromRows`/`getRadarData` usados com as mesmas assinaturas entre tasks; `result[ax.key]` indexado por chaves que existem em `RadarResult`. ✔

## Nota de decisão para a revisão do usuário

Decisão de produto embutida (coerente com o princípio "nunca 0 injustamente" que você aprovou, mas registrando para você poder vetar na revisão da fase): **consulta com Pensamento Clínico em branco** (AB4 vazio, sentinela) é tratada como *não medida* naquele eixo — não entra como 0. Mesmo tratamento já dado à comunicação vazia. Se você preferir que deixar o raciocínio em branco conte como 0 no eixo AB4 (penalizando a média), é trocar uma linha no `extractOverall`/`buildRadarInput`.
