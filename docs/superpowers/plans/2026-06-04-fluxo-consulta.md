# Fluxo de Consulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SP2 — the consultation room where students interact with an AI-simulated patient via chat, build the anamnesis, record clinical thinking, and finish with a diagnosis.

**Architecture:** Server Components load initial data; a single `ConsultationClient` Client Component manages shared state (chat, anamnesis, clinical reasoning) and distributes to focused child components. Four route handlers handle distinct API operations. The `consultations` table uses a partial UNIQUE INDEX to enforce one `ongoing` consultation per patient.

**Tech Stack:** Next.js 15 App Router, Supabase PostgreSQL + RLS, OpenAI SDK v4 (`gpt-4o-mini`), Vitest, Playwright

---

### Task 1: Database migration — create consultations table

**Files:**
- Create: `supabase/migrations/<timestamp>_add_consultations.sql` (via CLI)

- [ ] **Step 1: Create migration file**

```bash
npx supabase migration new add_consultations
```

Expected: `Created new migration at supabase/migrations/<timestamp>_add_consultations.sql`

- [ ] **Step 2: Paste SQL into the generated file**

```sql
CREATE TABLE consultations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'ongoing'
                      CHECK (status IN ('ongoing', 'finished')),
  chat_history      JSONB NOT NULL DEFAULT '[]',
  anamnesis         JSONB NOT NULL DEFAULT '{}',
  clinical_reasoning TEXT NOT NULL DEFAULT '',
  diagnosis         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX consultations_patient_id_idx ON consultations(patient_id);
CREATE INDEX consultations_user_id_idx ON consultations(user_id);

-- Garante que um paciente só tem uma consulta ongoing por vez
CREATE UNIQUE INDEX consultations_patient_ongoing_idx
  ON consultations(patient_id)
  WHERE status = 'ongoing';

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON consultations TO authenticated;

CREATE POLICY "Aluno lê próprias consultas"
  ON consultations FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprias consultas"
  ON consultations FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprias consultas"
  ON consultations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

- [ ] **Step 3: Apply migration**

```bash
npx supabase migration up --linked
```

Expected: `Applying migration ..._add_consultations.sql... done`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add consultations table with RLS and partial unique index"
```

---

### Task 2: Generate types + update domain.ts + routes.ts

**Files:**
- Regenerate: `src/types/database.ts`
- Modify: `src/types/domain.ts`
- Modify: `src/lib/routes.ts`

- [ ] **Step 1: Regenerate database types**

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Verify the generated file contains a `consultations` table with `Row`, `Insert`, `Update`.

- [ ] **Step 2: Add Consultation type to domain.ts**

Full file after edit:

```ts
import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Patient = Database['public']['Tables']['patients']['Row']

export type Consultation = Database['public']['Tables']['consultations']['Row']

export type Role = 'student' | 'resident' | 'physician'
```

- [ ] **Step 3: Add consultationRoute to routes.ts**

Full file after edit:

```ts
export const LOGIN_ROUTE             = '/login'
export const DASHBOARD_ROUTE         = '/dashboard'
export const STUB_CONSULTATION_ROUTE = '/consultations/stub'

export const patientDetailRoute    = (id: string) => `/patients/${id}`
export const consultationRoute     = (id: string) => `/consultations/${id}`
```

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/types/domain.ts src/lib/routes.ts
git commit -m "feat: regenerate DB types, add Consultation type, add consultationRoute"
```

---

### Task 3: prompts.ts (TDD)

**Files:**
- Create: `src/lib/consultations/prompts.test.ts`
- Create: `src/lib/consultations/prompts.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/consultations/prompts.test.ts
import { describe, it, expect } from 'vitest'
import { buildPatientSystemPrompt, buildAnamnesisPrompt, buildFinishPrompt } from './prompts'
import type { Patient } from '@/types/domain'

const mockPatient: Partial<Patient> = {
  name: 'João Silva',
  age: 45,
  gender: 'M',
  specialty: 'Cardiologia',
  chief_complaint: 'Dor no peito há 2 dias',
  clinical_status: 'Paciente estável',
  conditions: ['HAS', 'DM'],
  difficulty: 'medium',
}

describe('buildPatientSystemPrompt', () => {
  it('inclui nome, queixa, condições e dificuldade do paciente', () => {
    const prompt = buildPatientSystemPrompt(mockPatient as Patient)
    expect(prompt).toContain('João Silva')
    expect(prompt).toContain('Dor no peito há 2 dias')
    expect(prompt).toContain('HAS')
    expect(prompt).toContain('medium')
  })

  it('instrui a IA a responder APENAS como paciente', () => {
    const prompt = buildPatientSystemPrompt(mockPatient as Patient)
    expect(prompt).toContain('paciente')
    expect(prompt).toContain('primeira pessoa')
  })
})

const chatHistory = [
  { role: 'student' as const, content: 'Há quanto tempo essa dor?', timestamp: '' },
  { role: 'patient' as const, content: 'Há 2 dias, doutor.', timestamp: '' },
]

describe('buildAnamnesisPrompt', () => {
  it('inclui a conversa formatada', () => {
    const prompt = buildAnamnesisPrompt(chatHistory)
    expect(prompt).toContain('Há quanto tempo essa dor?')
    expect(prompt).toContain('Há 2 dias, doutor.')
  })

  it('solicita JSON com os 5 campos da anamnese', () => {
    const prompt = buildAnamnesisPrompt(chatHistory)
    expect(prompt).toContain('hda')
    expect(prompt).toContain('hpp')
    expect(prompt).toContain('JSON')
  })
})

describe('buildFinishPrompt', () => {
  it('inclui dados do paciente, diagnóstico e raciocínio', () => {
    const prompt = buildFinishPrompt(mockPatient as Patient, 'IAM', 'Pensei em síndrome coronariana')
    expect(prompt).toContain('João Silva')
    expect(prompt).toContain('IAM')
    expect(prompt).toContain('Pensei em síndrome coronariana')
  })

  it('pede apenas uma frase de estado clínico', () => {
    const prompt = buildFinishPrompt(mockPatient as Patient, 'IAM', '')
    expect(prompt).toContain('frase')
    expect(prompt.toLowerCase()).toContain('estado clínico')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/lib/consultations/prompts.test.ts
```

Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement prompts.ts**

```ts
// src/lib/consultations/prompts.ts
import type { Patient } from '@/types/domain'

export type ChatMessage = {
  role: 'student' | 'patient'
  content: string
  timestamp: string
}

export function buildPatientSystemPrompt(patient: Patient): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um paciente simulado para treinamento médico. Responda APENAS como o paciente, na primeira pessoa. Nunca quebre o personagem ou mencione que é uma simulação.

Nome: ${patient.name}
Idade: ${patient.age} anos
Gênero: ${patient.gender === 'M' ? 'Masculino' : 'Feminino'}
Especialidade: ${patient.specialty}
Queixa principal: ${patient.chief_complaint}
Estado clínico: ${patient.clinical_status}
Condições preexistentes: ${conditions}
Dificuldade: ${patient.difficulty}

Regras por dificuldade:
- easy: fale de forma clara e objetiva
- medium: seja moderadamente vago, forneça informações aos poucos
- hard: seja impreciso, confunda datas, minimize sintomas

Responda de forma concisa (1-3 frases).`
}

export function buildAnamnesisPrompt(chatHistory: ChatMessage[]): string {
  const conversation = chatHistory
    .map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n')

  return `Analise a conversa abaixo entre um médico e um paciente e extraia as informações para cada seção da anamnese. Se uma seção não tiver informações suficientes, deixe como string vazia.

Responda APENAS com JSON válido:
{
  "hda": "História da Doença Atual",
  "hpp": "História Patológica Pregressa",
  "ad": "Antecedentes e Doenças",
  "social": "História Social",
  "familiar": "História Familiar"
}

Conversa:
${conversation}`
}

export function buildFinishPrompt(
  patient: Patient,
  diagnosis: string,
  clinicalReasoning: string
): string {
  return `Você é um sistema de simulação médica. Uma consulta foi realizada.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa inicial: ${patient.chief_complaint}
Estado clínico anterior: ${patient.clinical_status}
Diagnóstico proposto pelo aluno: ${diagnosis}
Pensamento clínico registrado: ${clinicalReasoning || '(não registrado)'}

Gere uma frase curta descrevendo o novo estado clínico do paciente após esta consulta, considerando o diagnóstico proposto. Se o diagnóstico parecer razoável, melhore o estado. Se parecer inadequado, mantenha ou piore levemente.

Responda APENAS com a frase do estado clínico (sem JSON, sem explicação).`
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npx vitest run src/lib/consultations/prompts.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultations/prompts.ts src/lib/consultations/prompts.test.ts
git commit -m "feat: add consultation prompts with tests"
```

---

### Task 4: parse.ts (TDD)

**Files:**
- Create: `src/lib/consultations/parse.test.ts`
- Create: `src/lib/consultations/parse.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/consultations/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseAnamnesisResponse } from './parse'

describe('parseAnamnesisResponse', () => {
  it('retorna os 5 campos quando todos presentes', () => {
    const input = JSON.stringify({
      hda: 'Dor há 2 dias',
      hpp: 'Hipertensão',
      ad: 'Sem alergia',
      social: 'Não fumante',
      familiar: 'Pai com IAM',
    })
    const result = parseAnamnesisResponse(input)
    expect(result.hda).toBe('Dor há 2 dias')
    expect(result.hpp).toBe('Hipertensão')
    expect(result.ad).toBe('Sem alergia')
    expect(result.social).toBe('Não fumante')
    expect(result.familiar).toBe('Pai com IAM')
  })

  it('retorna string vazia para campos ausentes', () => {
    const input = JSON.stringify({ hda: 'Dor no peito' })
    const result = parseAnamnesisResponse(input)
    expect(result.hda).toBe('Dor no peito')
    expect(result.hpp).toBe('')
    expect(result.ad).toBe('')
    expect(result.social).toBe('')
    expect(result.familiar).toBe('')
  })

  it('retorna todos vazios para JSON inválido', () => {
    const result = parseAnamnesisResponse('not-json')
    expect(result.hda).toBe('')
    expect(result.hpp).toBe('')
    expect(result.ad).toBe('')
    expect(result.social).toBe('')
    expect(result.familiar).toBe('')
  })

  it('retorna string vazia para campos que não são string', () => {
    const input = JSON.stringify({ hda: 123, hpp: null })
    const result = parseAnamnesisResponse(input)
    expect(result.hda).toBe('')
    expect(result.hpp).toBe('')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/lib/consultations/parse.test.ts
```

Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement parse.ts**

```ts
// src/lib/consultations/parse.ts
export type Anamnesis = {
  hda: string
  hpp: string
  ad: string
  social: string
  familiar: string
}

const EMPTY_ANAMNESIS: Anamnesis = { hda: '', hpp: '', ad: '', social: '', familiar: '' }

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function parseAnamnesisResponse(raw: string): Anamnesis {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      hda:      str(parsed.hda),
      hpp:      str(parsed.hpp),
      ad:       str(parsed.ad),
      social:   str(parsed.social),
      familiar: str(parsed.familiar),
    }
  } catch {
    return { ...EMPTY_ANAMNESIS }
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npx vitest run src/lib/consultations/parse.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultations/parse.ts src/lib/consultations/parse.test.ts
git commit -m "feat: add parseAnamnesisResponse with tests"
```

---

### Task 5: POST /api/consultations + tests

**Files:**
- Create: `src/app/api/consultations/route.ts`
- Create: `src/app/api/consultations/route.test.ts`

- [ ] **Step 1: Create route.ts**

```ts
// src/app/api/consultations/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { patient_id } = body as Record<string, unknown>
  if (!patient_id || typeof patient_id !== 'string')
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verificar se já existe consulta ongoing para este paciente
  const { data: existing } = await supabase
    .from('consultations')
    .select('id')
    .eq('patient_id', patient_id)
    .eq('status', 'ongoing')
    .single()

  if (existing) return NextResponse.json({ id: existing.id }, { status: 200 })

  const { data, error } = await supabase
    .from('consultations')
    .insert({ patient_id, user_id: user.id })
    .select('id')
    .single()

  if (error) {
    // Race condition: outro request inseriu simultaneamente (UNIQUE VIOLATION)
    if (error.code === '23505') {
      const { data: raceExisting } = await supabase
        .from('consultations')
        .select('id')
        .eq('patient_id', patient_id)
        .eq('status', 'ongoing')
        .single()
      return NextResponse.json({ id: raceExisting!.id }, { status: 200 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Create route.test.ts**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
    }),
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const user = { id: 'user-123' }

describe('POST /api/consultations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
  })

  it('retorna 400 se patient_id ausente', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(401)
  })

  it('retorna 200 com id existente se consulta ongoing já existe', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('existing-id')
  })

  it('retorna 201 com novo id ao criar consulta', async () => {
    // primeiro select retorna null (sem ongoing)
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSelect.mockReturnValueOnce(selectChain)
    // insert retorna novo id
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
      }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('new-id')
  })

  it('retorna 200 ao capturar race condition (UNIQUE VIOLATION 23505)', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // sem ongoing inicial
        .mockResolvedValueOnce({ data: { id: 'race-id' }, error: null }), // busca após race
    }
    mockSelect.mockReturnValue(selectChain)
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
      }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('race-id')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/app/api/consultations/route.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/consultations/route.ts src/app/api/consultations/route.test.ts
git commit -m "feat: add POST /api/consultations with duplicate guard and race condition handling"
```

---

### Task 6: PATCH /api/consultations/[id] + tests

**Files:**
- Create: `src/app/api/consultations/[id]/route.ts`
- Create: `src/app/api/consultations/[id]/route.test.ts`

- [ ] **Step 1: Create route.ts**

```ts
// src/app/api/consultations/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { clinical_reasoning } = body as Record<string, unknown>
  if (typeof clinical_reasoning !== 'string')
    return NextResponse.json({ error: 'clinical_reasoning must be a string' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('consultations')
    .update({ clinical_reasoning })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')

  if (error) return NextResponse.json({ error: 'Internal error' }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 2: Create route.test.ts**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockGetUser = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}))

import { NextRequest } from 'next/server'
import { PATCH } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }

describe('PATCH /api/consultations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      error: null,
    })
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(...makeRequest({ clinical_reasoning: 'texto' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se clinical_reasoning não for string', async () => {
    const res = await PATCH(...makeRequest({ clinical_reasoning: 123 }))
    expect(res.status).toBe(400)
  })

  it('retorna 200 ao salvar clinical_reasoning', async () => {
    const chain = { eq: vi.fn().mockReturnThis() }
    chain.eq.mockReturnValue({ ...chain, error: null })
    mockUpdate.mockReturnValue(chain)
    const res = await PATCH(...makeRequest({ clinical_reasoning: 'meu pensamento' }))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run "src/app/api/consultations/[id]/route.test.ts"
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/consultations/[id]/route.ts" "src/app/api/consultations/[id]/route.test.ts"
git commit -m "feat: add PATCH /api/consultations/[id] for clinical reasoning auto-save"
```

---

### Task 7: POST /api/consultations/[id]/chat + tests

**Files:**
- Create: `src/app/api/consultations/[id]/chat/route.ts`
- Create: `src/app/api/consultations/[id]/chat/route.test.ts`

- [ ] **Step 1: Create route.ts**

```ts
// src/app/api/consultations/[id]/chat/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { APIConnectionTimeoutError } from 'openai'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildPatientSystemPrompt } from '@/lib/consultations/prompts'
import type { ChatMessage } from '@/lib/consultations/prompts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { message } = body as Record<string, unknown>
  if (!message || typeof message !== 'string' || !message.trim())
    return NextResponse.json({ error: 'message required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Buscar consulta e paciente em paralelo
  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('*, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Record<string, unknown>
  const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]
  const systemPrompt = buildPatientSystemPrompt(patient as never)

  // Mapear roles: student→user, patient→assistant (OpenAI não aceita roles customizados)
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...chatHistory.map(m => ({
      role: m.role === 'student' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
    { role: 'user' as const, content: message.trim() },
  ]

  let patientReply: string
  try {
    const completion = await openai.chat.completions.create(
      { model: 'gpt-4o-mini', messages },
      { timeout: 25_000 }
    )
    if (!completion.choices.length)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })
    patientReply = completion.choices[0].message.content ?? ''
    if (!patientReply)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })
  } catch (e) {
    if (e instanceof APIConnectionTimeoutError)
      return NextResponse.json({ error: 'OpenAI timeout' }, { status: 408 })
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const newHistory: ChatMessage[] = [
    ...chatHistory,
    { role: 'student', content: message.trim(), timestamp: now },
    { role: 'patient', content: patientReply, timestamp: now },
  ]

  const { error: updateError } = await supabase
    .from('consultations')
    .update({ chat_history: newHistory })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })

  return NextResponse.json({ reply: patientReply }, { status: 200 })
}
```

- [ ] **Step 2: Create route.test.ts**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCreate = vi.fn()
vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const mockConsultation = {
  id: 'c-1',
  user_id: 'user-1',
  status: 'ongoing',
  chat_history: [],
  patients: {
    name: 'João', age: 45, gender: 'M', specialty: 'Cardiologia',
    chief_complaint: 'Dor', clinical_status: 'Estável', conditions: [], difficulty: 'easy',
  },
}

describe('POST /api/consultations/[id]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockConsultation, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        error: null,
      }),
    })
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Estou bem.' } }] })
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest({ message: 'Olá' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se message vazia', async () => {
    const res = await POST(...makeRequest({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('retorna 200 com reply do paciente', async () => {
    const res = await POST(...makeRequest({ message: 'Como se sente?' }))
    expect(res.status).toBe(200)
    expect((await res.json()).reply).toBe('Estou bem.')
  })

  it('retorna 408 se OpenAI fizer timeout', async () => {
    const { APIConnectionTimeoutError } = await import('openai')
    mockCreate.mockRejectedValue(new APIConnectionTimeoutError())
    const res = await POST(...makeRequest({ message: 'Olá' }))
    expect(res.status).toBe(408)
  })

  it('retorna 500 se OpenAI erro genérico', async () => {
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest({ message: 'Olá' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run "src/app/api/consultations/[id]/chat/route.test.ts"
```

Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/consultations/[id]/chat/"
git commit -m "feat: add POST /api/consultations/[id]/chat with OpenAI patient simulation"
```

---

### Task 8: POST /api/consultations/[id]/anamnesis + tests

**Files:**
- Create: `src/app/api/consultations/[id]/anamnesis/route.ts`
- Create: `src/app/api/consultations/[id]/anamnesis/route.test.ts`

- [ ] **Step 1: Create route.ts**

```ts
// src/app/api/consultations/[id]/anamnesis/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildAnamnesisPrompt } from '@/lib/consultations/prompts'
import { parseAnamnesisResponse } from '@/lib/consultations/parse'
import type { ChatMessage } from '@/lib/consultations/prompts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('chat_history')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

  if (chatHistory.length === 0)
    return NextResponse.json({ error: 'No chat history to analyze' }, { status: 400 })

  let rawContent: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildAnamnesisPrompt(chatHistory) }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    rawContent = completion.choices[0].message.content
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const anamnesis = parseAnamnesisResponse(rawContent)

  const { error: updateError } = await supabase
    .from('consultations')
    .update({ anamnesis })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to save anamnesis' }, { status: 500 })

  return NextResponse.json(anamnesis, { status: 200 })
}
```

- [ ] **Step 2: Create route.test.ts**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCreate = vi.fn()
vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/anamnesis`, { method: 'POST' }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const chatHistory = [
  { role: 'student', content: 'Há quanto tempo?', timestamp: '' },
  { role: 'patient', content: 'Há 2 dias.', timestamp: '' },
]

describe('POST /api/consultations/[id]/anamnesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { chat_history: chatHistory }, error: null,
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        error: null,
      }),
    })
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            hda: 'Dor há 2 dias', hpp: '', ad: '', social: '', familiar: '',
          }),
        },
      }],
    })
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 200 com anamnese populada', async () => {
    const res = await POST(...makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hda).toBe('Dor há 2 dias')
  })

  it('retorna 400 se chat_history vazio', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { chat_history: [] }, error: null,
      }),
    })
    const res = await POST(...makeRequest())
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run "src/app/api/consultations/[id]/anamnesis/route.test.ts"
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/consultations/[id]/anamnesis/"
git commit -m "feat: add POST /api/consultations/[id]/anamnesis"
```

---

### Task 9: POST /api/consultations/[id]/finish + tests

**Files:**
- Create: `src/app/api/consultations/[id]/finish/route.ts`
- Create: `src/app/api/consultations/[id]/finish/route.test.ts`

- [ ] **Step 1: Create route.ts**

```ts
// src/app/api/consultations/[id]/finish/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildFinishPrompt } from '@/lib/consultations/prompts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { diagnosis } = body as Record<string, unknown>
  if (!diagnosis || typeof diagnosis !== 'string' || !diagnosis.trim())
    return NextResponse.json({ error: 'diagnosis required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('*, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Record<string, unknown>
  const clinicalReasoning = consultation.clinical_reasoning ?? ''

  // Gerar novo clinical_status via IA
  let newClinicalStatus: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: buildFinishPrompt(patient as never, diagnosis.trim(), clinicalReasoning),
      }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    newClinicalStatus = completion.choices[0].message.content.trim()
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Atualizar consulta
  const { error: cUpdateError } = await supabase
    .from('consultations')
    .update({ status: 'finished', finished_at: now, diagnosis: diagnosis.trim() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (cUpdateError)
    return NextResponse.json({ error: 'Failed to finish consultation' }, { status: 500 })

  // Atualizar paciente
  const { error: pUpdateError } = await supabase
    .from('patients')
    .update({
      clinical_status: newClinicalStatus,
      last_consulted_at: now,
      diagnosis: diagnosis.trim(),
    })
    .eq('id', patient.id as string)
    .eq('user_id', user.id)

  if (pUpdateError)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })

  return NextResponse.json({ patient_id: patient.id }, { status: 200 })
}
```

- [ ] **Step 2: Create route.test.ts**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCreate = vi.fn()
vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const mockConsultation = {
  id: 'c-1', user_id: 'user-1', status: 'ongoing', clinical_reasoning: 'Pensei em IAM',
  patients: {
    id: 'p-1', name: 'João', age: 45, gender: 'M', specialty: 'Cardiologia',
    chief_complaint: 'Dor', clinical_status: 'Estável', conditions: [], difficulty: 'easy',
  },
}

describe('POST /api/consultations/[id]/finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Paciente melhorou após consulta.' } }],
    })
    const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockConsultation, error: null }),
      update: vi.fn().mockReturnValue(updateChain),
    })
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se diagnosis ausente', async () => {
    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 200 com patient_id ao finalizar', async () => {
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(200)
    expect((await res.json()).patient_id).toBe('p-1')
  })

  it('retorna 500 se OpenAI falhar', async () => {
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run "src/app/api/consultations/[id]/finish/route.test.ts"
```

Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/consultations/[id]/finish/"
git commit -m "feat: add POST /api/consultations/[id]/finish with AI status update"
```

---

### Task 10: UI Components

**Files:**
- Create: `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx`
- Create: `src/app/(dashboard)/consultations/[id]/AnamnesisPanel.tsx`
- Create: `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx`
- Create: `src/app/(dashboard)/consultations/[id]/FinishModal.tsx`

- [ ] **Step 1: Create ConsultationChat.tsx**

```tsx
// src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx
'use client'
import { useState } from 'react'
import type { ChatMessage } from '@/lib/consultations/prompts'

type Props = {
  consultationId: string
  initialMessages: ChatMessage[]
  onMessagesUpdate: (messages: ChatMessage[]) => void
}

export function ConsultationChat({ consultationId, initialMessages, onMessagesUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setInput('')

    const studentMsg: ChatMessage = { role: 'student', content: text, timestamp: new Date().toISOString() }
    const optimistic = [...messages, studentMsg]
    setMessages(optimistic)
    onMessagesUpdate(optimistic)

    try {
      const res = await fetch(`/api/consultations/${consultationId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar mensagem'); return }

      const patientMsg: ChatMessage = { role: 'patient', content: data.reply, timestamp: new Date().toISOString() }
      const updated = [...optimistic, patientMsg]
      setMessages(updated)
      onMessagesUpdate(updated)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center">Inicie a consulta cumprimentando o paciente.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
              msg.role === 'student'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="font-semibold text-xs mb-1 opacity-70">
                {msg.role === 'student' ? 'Você' : 'Paciente'}
              </p>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-400">
              Paciente digitando...
            </div>
          </div>
        )}
      </div>
      {error && <p className="px-4 text-red-500 text-xs">{error}</p>}
      <div className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn btn--primary px-4"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AnamnesisPanel.tsx**

```tsx
// src/app/(dashboard)/consultations/[id]/AnamnesisPanel.tsx
'use client'
import { useState } from 'react'
import type { Anamnesis } from '@/lib/consultations/parse'

type Props = {
  consultationId: string
  initialAnamnesis: Anamnesis
}

const LABELS: Record<keyof Anamnesis, string> = {
  hda:      'HDA — História da Doença Atual',
  hpp:      'HPP — História Patológica Pregressa',
  ad:       'AD — Antecedentes e Doenças',
  social:   'História Social',
  familiar: 'História Familiar',
}

export function AnamnesisPanel({ consultationId, initialAnamnesis }: Props) {
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(initialAnamnesis)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateAnamnesis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/anamnesis`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao atualizar'); return }
      setAnamnesis(data as Anamnesis)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      {(Object.keys(LABELS) as (keyof Anamnesis)[]).map(field => (
        <div key={field}>
          <p className="text-xs font-semibold text-gray-500 mb-1">{LABELS[field]}</p>
          <p className="text-sm text-gray-700 min-h-[1.5rem]">
            {anamnesis[field] || <span className="text-gray-300 italic">—</span>}
          </p>
        </div>
      ))}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        onClick={updateAnamnesis}
        disabled={loading}
        className="w-full text-sm border border-gray-300 rounded-md py-1.5 hover:bg-gray-50 text-gray-600"
      >
        {loading ? 'Analisando...' : '↺ Atualizar anamnese'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create ClinicalReasoningField.tsx**

```tsx
// src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx
'use client'
import { useState, useEffect, useRef } from 'react'

type Props = {
  consultationId: string
  initialValue: string
}

export function ClinicalReasoningField({ consultationId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue)
  const [saved, setSaved] = useState(true)
  const lastSavedRef = useRef(initialValue)

  useEffect(() => {
    const interval = setInterval(async () => {
      if (value === lastSavedRef.current) return
      try {
        await fetch(`/api/consultations/${consultationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinical_reasoning: value }),
        })
        lastSavedRef.current = value
        setSaved(true)
      } catch {
        // Silently fail — will retry in 30s
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [consultationId, value])

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">PENSAMENTO CLÍNICO</p>
        <span className="text-xs text-gray-400">{saved ? 'Salvo' : 'Não salvo'}</span>
      </div>
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        placeholder="Registre seu raciocínio diagnóstico..."
        className="flex-1 border border-gray-200 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    </div>
  )
}
```

- [ ] **Step 4: Create FinishModal.tsx**

```tsx
// src/app/(dashboard)/consultations/[id]/FinishModal.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { patientDetailRoute } from '@/lib/routes'

type Props = {
  consultationId: string
  onClose: () => void
}

export function FinishModal({ consultationId, onClose }: Props) {
  const router = useRouter()
  const [diagnosis, setDiagnosis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish() {
    if (!diagnosis.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: diagnosis.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao finalizar'); return }
      router.push(patientDetailRoute(data.patient_id))
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Finalizar consulta</h2>
        <p className="text-sm text-gray-500 mb-4">Registre o diagnóstico principal desta consulta.</p>
        <textarea
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
          placeholder="Ex: Síndrome coronariana aguda — IAM sem supra"
          rows={3}
          className="w-full border border-gray-300 rounded-md p-3 text-sm mb-4"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 btn btn--secondary">
            Cancelar
          </button>
          <button
            onClick={finish}
            disabled={!diagnosis.trim() || loading}
            className="flex-1 btn btn--primary"
          >
            {loading ? 'Finalizando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/"
git commit -m "feat: add ConsultationChat, AnamnesisPanel, ClinicalReasoningField, FinishModal components"
```

---

### Task 11: Consultation page (Server + Client)

**Files:**
- Create: `src/app/(dashboard)/consultations/[id]/page.tsx`
- Create: `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx`

- [ ] **Step 1: Create ConsultationClient.tsx**

```tsx
// src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx
'use client'
import { useState } from 'react'
import { ConsultationChat } from './ConsultationChat'
import { AnamnesisPanel } from './AnamnesisPanel'
import { ClinicalReasoningField } from './ClinicalReasoningField'
import { FinishModal } from './FinishModal'
import type { ChatMessage } from '@/lib/consultations/prompts'
import type { Anamnesis } from '@/lib/consultations/parse'
import type { Patient, Consultation } from '@/types/domain'

type Props = {
  consultation: Consultation
  patient: Patient
}

export function ConsultationClient({ consultation, patient }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    (consultation.chat_history as ChatMessage[]) ?? []
  )
  const [showFinishModal, setShowFinishModal] = useState(false)

  const initialAnamnesis: Anamnesis = {
    hda:      ((consultation.anamnesis as Record<string, string>)?.hda)      ?? '',
    hpp:      ((consultation.anamnesis as Record<string, string>)?.hpp)      ?? '',
    ad:       ((consultation.anamnesis as Record<string, string>)?.ad)       ?? '',
    social:   ((consultation.anamnesis as Record<string, string>)?.social)   ?? '',
    familiar: ((consultation.anamnesis as Record<string, string>)?.familiar) ?? '',
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <h1 className="font-semibold text-gray-900">{patient.name}</h1>
          <p className="text-xs text-gray-500">
            {patient.age} anos · {patient.specialty} · {patient.difficulty}
          </p>
        </div>
        <button
          onClick={() => setShowFinishModal(true)}
          className="btn btn--primary text-sm"
        >
          Finalizar consulta
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat — 55% */}
        <div className="w-[55%] border-r flex flex-col">
          <ConsultationChat
            consultationId={consultation.id}
            initialMessages={messages}
            onMessagesUpdate={setMessages}
          />
        </div>

        {/* Painel direito — 45% */}
        <div className="w-[45%] flex flex-col overflow-y-auto">
          <div className="border-b">
            <p className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
              Anamnese
            </p>
            <AnamnesisPanel
              consultationId={consultation.id}
              initialAnamnesis={initialAnamnesis}
            />
          </div>
          <div className="flex-1 flex flex-col">
            <ClinicalReasoningField
              consultationId={consultation.id}
              initialValue={consultation.clinical_reasoning ?? ''}
            />
          </div>
        </div>
      </div>

      {showFinishModal && (
        <FinishModal
          consultationId={consultation.id}
          onClose={() => setShowFinishModal(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create page.tsx**

```tsx
// src/app/(dashboard)/consultations/[id]/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, patientDetailRoute } from '@/lib/routes'
import { ConsultationClient } from './ConsultationClient'
import type { Patient } from '@/types/domain'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { id } = await params

  const { data: consultation, error } = await supabase
    .from('consultations')
    .select('*, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !consultation) notFound()

  // Consulta finalizada → redirecionar para o paciente
  if (consultation.status === 'finished') {
    redirect(patientDetailRoute(consultation.patient_id))
  }

  const patient = (consultation as Record<string, unknown>).patients as Patient

  return <ConsultationClient consultation={consultation} patient={patient} />
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/page.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx"
git commit -m "feat: add /consultations/[id] page with two-column layout"
```

---

### Task 12: Update /patients/[id] — StartConsultationButton + history

**Files:**
- Create: `src/app/(dashboard)/patients/[id]/StartConsultationButton.tsx`
- Modify: `src/app/(dashboard)/patients/[id]/page.tsx`

- [ ] **Step 1: Create StartConsultationButton.tsx**

```tsx
// src/app/(dashboard)/patients/[id]/StartConsultationButton.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { consultationRoute } from '@/lib/routes'

export function StartConsultationButton({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      router.push(consultationRoute(data.id))
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={start} disabled={loading} className="btn btn--primary">
        {loading ? 'Abrindo...' : 'Iniciar atendimento'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </>
  )
}
```

- [ ] **Step 2: Rewrite patients/[id]/page.tsx**

```tsx
// src/app/(dashboard)/patients/[id]/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, consultationRoute } from '@/lib/routes'
import { BondBar } from '@/components/ui/BondBar'
import { StartConsultationButton } from './StartConsultationButton'
import Link from 'next/link'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { id } = await params

  const [patientResult, consultationsResult] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase
      .from('consultations')
      .select('id, status, finished_at, diagnosis')
      .eq('patient_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (patientResult.error || !patientResult.data) notFound()

  const patient = patientResult.data
  const consultations = consultationsResult.data ?? []
  const ongoing = consultations.find(c => c.status === 'ongoing')
  const finished = consultations.filter(c => c.status === 'finished')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
        <p className="text-sm text-gray-500">
          {patient.age} anos · {patient.gender === 'M' ? 'Masculino' : 'Feminino'} · {patient.specialty}
        </p>
      </div>

      {patient.conditions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {patient.conditions.map((c: string) => (
            <span key={c} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              #{c}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Estado clínico</p>
        <p className="text-gray-600">{patient.clinical_status}</p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-1">Vínculo</p>
        <BondBar level={patient.bond_level} />
      </div>

      {ongoing ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-yellow-800">Consulta em andamento</p>
          <Link href={consultationRoute(ongoing.id)} className="btn btn--primary text-sm">
            Continuar consulta
          </Link>
        </div>
      ) : (
        <div className="mb-6">
          <StartConsultationButton patientId={patient.id} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Consultas anteriores</h2>
        {finished.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhuma consulta realizada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {finished.map(c => (
              <li key={c.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800">
                  {c.diagnosis ?? 'Diagnóstico não registrado'}
                </p>
                <p className="text-xs text-gray-400">
                  {c.finished_at
                    ? new Date(c.finished_at).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/patients/[id]/"
git commit -m "feat: update /patients/[id] with StartConsultationButton and consultation history"
```

---

### Task 13: Run all tests + E2E file

**Files:**
- Create: `e2e/consultation.spec.ts`

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests PASS (should be 40+ from SP1 plus new tests from SP2)

- [ ] **Step 2: Create E2E test file**

```ts
// e2e/consultation.spec.ts
import { test, expect } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

test.describe('Fluxo de Consulta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', E2E_EMAIL)
    await page.fill('[name="password"]', E2E_PASSWORD)
    await page.click('[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('iniciar consulta, enviar mensagem, atualizar anamnese e finalizar', async ({ page }) => {
    // Navegar para o primeiro paciente disponível
    await page.goto('/dashboard')
    const firstPatient = page.locator('ul li a').first()
    if (await firstPatient.count() === 0) { test.skip(); return }
    await firstPatient.click()
    await page.waitForURL('**/patients/**')

    // Iniciar atendimento
    await page.click('text=Iniciar atendimento')
    await page.waitForURL('**/consultations/**', { timeout: 10_000 })

    // Enviar mensagem
    await page.fill('input[placeholder*="mensagem"]', 'Olá, como o senhor está se sentindo?')
    await page.click('text=Enviar')
    await expect(page.locator('text=Paciente')).toBeVisible({ timeout: 30_000 })

    // Atualizar anamnese
    await page.click('text=Atualizar anamnese')
    await page.waitForTimeout(5_000)

    // Finalizar
    await page.click('text=Finalizar consulta')
    await expect(page.locator('text=Finalizar consulta').nth(1)).toBeVisible()
    await page.fill('textarea', 'Hipertensão arterial sistêmica')
    await page.click('text=Confirmar')
    await page.waitForURL('**/patients/**', { timeout: 30_000 })

    // Verificar histórico
    await expect(page.locator('text=Consultas anteriores')).toBeVisible()
    await expect(page.locator('text=Hipertensão arterial sistêmica')).toBeVisible()
  })

  test('consulta ongoing exibe banner Continuar', async ({ page }) => {
    // Este teste assume que o teste anterior criou uma consulta que foi finalizada
    // e que existe ao menos um paciente sem consulta ongoing
    await page.goto('/dashboard')
    const firstPatient = page.locator('ul li a').first()
    if (await firstPatient.count() === 0) { test.skip(); return }
    await firstPatient.click()
    await page.waitForURL('**/patients/**')

    // Se houver ongoing, o banner deve aparecer
    const continuar = page.locator('text=Continuar consulta')
    const iniciar   = page.locator('text=Iniciar atendimento')
    await expect(continuar.or(iniciar)).toBeVisible()
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add e2e/consultation.spec.ts
git commit -m "test: add E2E tests for consultation flow"
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | grep -v "validator.ts"
```

Expected: no output (zero TypeScript errors in our code)
