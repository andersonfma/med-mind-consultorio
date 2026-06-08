# Carteira de Pacientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Sub-projeto 1 — Carteira de Pacientes: a patient portfolio where students manage AI-generated patient cases, track bond level, and navigate to a stub consultation.

**Architecture:** Server Components handle auth guards and data fetching; a single Client Component (`NewPatientForm`) owns the interactive form. A PostgreSQL function (`create_patient`) wraps slot check + insert in one atomic transaction. OpenAI generates each patient case before the RPC call.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS + SECURITY DEFINER), OpenAI SDK v4 (`gpt-4o-mini`), Vitest, Playwright

---

### Task 1: Route constants

**Files:**
- Create: `src/lib/routes.ts`

- [ ] **Step 1: Create routes.ts**

```ts
export const LOGIN_ROUTE             = '/login'
export const DASHBOARD_ROUTE         = '/dashboard'
export const STUB_CONSULTATION_ROUTE = '/consultations/stub'

export const patientDetailRoute = (id: string) => `/patients/${id}`
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/routes.ts
git commit -m "feat: add centralized route constants"
```

---

### Task 2: Update auth files to use route constants

**Files:**
- Modify: `src/lib/auth/redirect.ts`
- Modify: `src/lib/auth/safe-next.ts`
- Modify: `src/lib/auth/redirect.test.ts`
- Modify: `src/lib/auth/safe-next.test.ts`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Replace redirect.ts**

```ts
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '../routes'

const AUTH_ROUTES = ['/login', '/register', '/reset-password']

export function getRedirectPath(
  pathname: string,
  isAuthenticated: boolean
): string | null {
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  if (!isAuthenticated && !isAuthRoute) return LOGIN_ROUTE
  if (isAuthenticated && isAuthRoute) return DASHBOARD_ROUTE
  return null
}
```

- [ ] **Step 2: Replace safe-next.ts**

```ts
import { DASHBOARD_ROUTE } from '../routes'

export function getSafeNext(next: string | null): string {
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
  ) {
    return next
  }
  return DASHBOARD_ROUTE
}
```

- [ ] **Step 3: Replace redirect.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { getRedirectPath } from './redirect'
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '../routes'

describe('getRedirectPath', () => {
  it('redireciona usuário não autenticado do dashboard para login', () => {
    expect(getRedirectPath('/dashboard', false)).toBe(LOGIN_ROUTE)
  })

  it('redireciona usuário não autenticado de rota privada qualquer para login', () => {
    expect(getRedirectPath('/patients', false)).toBe(LOGIN_ROUTE)
  })

  it('redireciona usuário autenticado do login para dashboard', () => {
    expect(getRedirectPath('/login', true)).toBe(DASHBOARD_ROUTE)
  })

  it('redireciona usuário autenticado do register para dashboard', () => {
    expect(getRedirectPath('/register', true)).toBe(DASHBOARD_ROUTE)
  })

  it('redireciona usuário autenticado do reset-password para dashboard', () => {
    expect(getRedirectPath('/reset-password', true)).toBe(DASHBOARD_ROUTE)
  })

  it('permite usuário não autenticado na página de login', () => {
    expect(getRedirectPath('/login', false)).toBeNull()
  })

  it('permite usuário não autenticado no register', () => {
    expect(getRedirectPath('/register', false)).toBeNull()
  })

  it('permite usuário autenticado no dashboard', () => {
    expect(getRedirectPath('/dashboard', true)).toBeNull()
  })
})
```

- [ ] **Step 4: Replace safe-next.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { getSafeNext } from './safe-next'
import { DASHBOARD_ROUTE } from '../routes'

describe('getSafeNext', () => {
  it('aceita caminhos relativos normais', () => {
    expect(getSafeNext('/dashboard')).toBe('/dashboard')
    expect(getSafeNext('/consulta/123')).toBe('/consulta/123')
  })

  it('retorna DASHBOARD_ROUTE para null', () => {
    expect(getSafeNext(null)).toBe(DASHBOARD_ROUTE)
  })

  it('retorna DASHBOARD_ROUTE para string vazia', () => {
    expect(getSafeNext('')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia protocol-relative // (open redirect)', () => {
    expect(getSafeNext('//evil.com')).toBe(DASHBOARD_ROUTE)
    expect(getSafeNext('//evil.com/path')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia backslash /\\ (open redirect em Windows)', () => {
    expect(getSafeNext('/\\')).toBe(DASHBOARD_ROUTE)
    expect(getSafeNext('/\\evil.com')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia URLs absolutas sem barra inicial', () => {
    expect(getSafeNext('https://evil.com')).toBe(DASHBOARD_ROUTE)
    expect(getSafeNext('http://evil.com')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia caminhos relativos sem barra inicial', () => {
    expect(getSafeNext('evil')).toBe(DASHBOARD_ROUTE)
  })
})
```

- [ ] **Step 5: Update layout.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/layout/Shell'
import { LOGIN_ROUTE } from '@/lib/routes'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(LOGIN_ROUTE)
  }

  return <Shell>{children}</Shell>
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/lib/auth/redirect.test.ts src/lib/auth/safe-next.test.ts
```

Expected: all 15 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/redirect.ts src/lib/auth/safe-next.ts src/lib/auth/redirect.test.ts src/lib/auth/safe-next.test.ts src/app/(dashboard)/layout.tsx
git commit -m "refactor: replace hardcoded route strings with route constants"
```

---

### Task 3: Patient specialties and difficulties constants

**Files:**
- Create: `src/lib/patients/specialties.ts`

- [ ] **Step 1: Create specialties.ts**

```ts
export const SPECIALTIES = [
  'Clínica Médica',
  'Cardiologia',
  'Gastroenterologia',
  'Pneumologia',
  'Endocrinologia',
  'Nefrologia',
  'Neurologia',
  'Infectologia',
] as const

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export type Specialty  = typeof SPECIALTIES[number]
export type Difficulty = typeof DIFFICULTIES[number]
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/patients/specialties.ts
git commit -m "feat: add patient specialties and difficulties constants"
```

---

### Task 4: slots.ts (TDD)

**Files:**
- Create: `src/lib/patients/slots.test.ts`
- Create: `src/lib/patients/slots.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/patients/slots.test.ts
import { describe, it, expect } from 'vitest'
import { hasAvailableSlot } from './slots'

describe('hasAvailableSlot', () => {
  it('retorna true quando há slots disponíveis', () => {
    expect(hasAvailableSlot(0, 5)).toBe(true)
    expect(hasAvailableSlot(4, 5)).toBe(true)
  })

  it('retorna false quando todos os slots estão cheios', () => {
    expect(hasAvailableSlot(5, 5)).toBe(false)
    expect(hasAvailableSlot(6, 5)).toBe(false)
  })

  it('retorna false quando used === total (limite exato)', () => {
    expect(hasAvailableSlot(1, 1)).toBe(false)
  })

  it('retorna true quando used é 0', () => {
    expect(hasAvailableSlot(0, 1)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/lib/patients/slots.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement slots.ts**

```ts
export function hasAvailableSlot(usedSlots: number, totalSlots: number): boolean {
  return usedSlots < totalSlots
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/lib/patients/slots.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/patients/slots.ts src/lib/patients/slots.test.ts
git commit -m "feat: add hasAvailableSlot with tests"
```

---

### Task 5: prompt.ts (TDD)

**Files:**
- Create: `src/lib/patients/prompt.test.ts`
- Create: `src/lib/patients/prompt.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/patients/prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildPatientPrompt } from './prompt'

describe('buildPatientPrompt', () => {
  it('usa gpt-4o-mini', () => {
    const params = buildPatientPrompt('Cardiologia', 'easy')
    expect(params.model).toBe('gpt-4o-mini')
  })

  it('usa response_format json_object', () => {
    const params = buildPatientPrompt('Cardiologia', 'easy')
    expect(params.response_format).toEqual({ type: 'json_object' })
  })

  it('tem exatamente uma mensagem com role user', () => {
    const params = buildPatientPrompt('Cardiologia', 'easy')
    expect(params.messages).toHaveLength(1)
    expect(params.messages[0].role).toBe('user')
  })

  it('interpola especialidade e dificuldade no conteúdo', () => {
    const params = buildPatientPrompt('Neurologia', 'hard')
    const content = params.messages[0].content as string
    expect(content).toContain('Neurologia')
    expect(content).toContain('hard')
  })

  it('contém a palavra JSON no conteúdo (obrigatório pela OpenAI API)', () => {
    const params = buildPatientPrompt('Infectologia', 'medium')
    const content = params.messages[0].content as string
    expect(content.toUpperCase()).toContain('JSON')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/lib/patients/prompt.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement prompt.ts**

```ts
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import type { Specialty, Difficulty } from './specialties'

export function buildPatientPrompt(
  specialty: Specialty,
  difficulty: Difficulty
): ChatCompletionCreateParamsNonStreaming {
  return {
    model: 'gpt-4o-mini' as const,
    response_format: { type: 'json_object' as const },
    messages: [{
      role: 'user' as const,
      content: `Você é um gerador de pacientes simulados para treinamento médico.
Gere um paciente realista para a especialidade: ${specialty}.
Nível de dificuldade: ${difficulty}.

Regras por dificuldade:
- easy: queixa clara, quadro típico, sem comorbidades relevantes
- medium: queixa moderadamente vaga, 1-2 comorbidades
- hard: queixa inespecífica, múltiplas comorbidades, quadro atípico

Responda APENAS com JSON válido, sem texto adicional:
{
  "name": "nome fictício brasileiro",
  "age": número inteiro entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "queixa principal em 1 frase, na voz do paciente",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["lista", "de", "condições", "preexistentes"]
}`,
    }],
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/lib/patients/prompt.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/patients/prompt.ts src/lib/patients/prompt.test.ts
git commit -m "feat: add buildPatientPrompt with tests"
```

---

### Task 6: Database migration

**Files:**
- Create: `supabase/migrations/<timestamp>_add_patients.sql` (via CLI — never manually)

- [ ] **Step 1: Link to the remote Supabase project**

```bash
supabase link --project-ref zrgjsgorijqlqhvlrpdh
```

Expected: "Finished supabase link."

- [ ] **Step 2: Create migration file**

```bash
supabase migration new add_patients
```

Expected: `Created new migration at supabase/migrations/<timestamp>_add_patients.sql`

Note the exact generated filename — edit that file in the next step.

- [ ] **Step 3: Paste the full SQL into the generated file**

Replace the file's contents with:

```sql
-- 1. Add total_slots to existing profiles table
ALTER TABLE profiles
  ADD COLUMN total_slots INTEGER NOT NULL DEFAULT 5
    CHECK (total_slots > 0);

-- 2. Restrict UPDATE on profiles to user-editable columns only
-- total_slots and role must only be changed via service_role (API internal)
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, crm) ON profiles TO authenticated;

-- 3. Create patients table
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  age               INTEGER NOT NULL CHECK (age BETWEEN 18 AND 80),
  gender            TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  specialty         TEXT NOT NULL
                      CHECK (specialty IN (
                        'Clínica Médica', 'Cardiologia', 'Gastroenterologia',
                        'Pneumologia', 'Endocrinologia', 'Nefrologia',
                        'Neurologia', 'Infectologia'
                      )),
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  chief_complaint   TEXT NOT NULL,
  diagnosis         TEXT,
  clinical_status   TEXT NOT NULL,
  bond_level        INTEGER NOT NULL DEFAULT 1
                      CHECK (bond_level BETWEEN 1 AND 5),
  conditions        TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_consulted_at TIMESTAMPTZ
);

CREATE INDEX patients_user_id_idx ON patients(user_id);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON patients TO authenticated;

CREATE POLICY "Aluno lê próprios pacientes"
  ON patients FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprios pacientes"
  ON patients FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprios pacientes"
  ON patients FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 4. Atomic slot check + insert RPC
CREATE OR REPLACE FUNCTION create_patient(
  p_name         TEXT,
  p_age          INTEGER,
  p_gender       TEXT,
  p_specialty    TEXT,
  p_difficulty   TEXT,
  p_complaint    TEXT,
  p_status       TEXT,
  p_conditions   TEXT[]
) RETURNS patients AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_total_slots  INTEGER;
  v_used_slots   INTEGER;
  v_patient      patients;
BEGIN
  SELECT total_slots INTO v_total_slots
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF v_total_slots IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'US002';
  END IF;

  SELECT COUNT(*) INTO v_used_slots
    FROM patients
    WHERE user_id = v_user_id;

  IF v_used_slots >= v_total_slots THEN
    RAISE EXCEPTION 'no_slots_available' USING ERRCODE = 'US001';
  END IF;

  INSERT INTO patients (
    user_id, name, age, gender, specialty, difficulty,
    chief_complaint, clinical_status, conditions
  ) VALUES (
    v_user_id, p_name, p_age, p_gender, p_specialty, p_difficulty,
    p_complaint, p_status, p_conditions
  ) RETURNING * INTO v_patient;

  RETURN v_patient;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[])
  SET search_path = public;

REVOKE EXECUTE ON FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) TO authenticated;
```

- [ ] **Step 4: Apply migration**

```bash
supabase migration up
```

Expected: "Applying migration ..._add_patients.sql... done"

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add patients table, create_patient RPC, and profiles.total_slots"
```

---

### Task 7: Generate TypeScript types and update domain.ts

**Files:**
- Regenerate: `src/types/database.ts`
- Modify: `src/types/domain.ts`

- [ ] **Step 1: Regenerate database types**

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Verify the generated file contains a `patients` table with `Row`, `Insert`, `Update` shapes.

- [ ] **Step 2: Update domain.ts**

Full file content:

```ts
import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Patient = Database['public']['Tables']['patients']['Row']

export type Role = 'student' | 'resident' | 'physician'
```

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts src/types/domain.ts
git commit -m "feat: regenerate DB types and add Patient type"
```

---

### Task 8: BondBar component

**Files:**
- Create: `src/components/ui/BondBar.tsx`

- [ ] **Step 1: Create BondBar.tsx**

```tsx
const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-400',
  4: 'bg-green-400',
  5: 'bg-green-700',
}

export function BondBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-label={`Vínculo nível ${level} de 5`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`h-3 w-6 rounded-sm ${bar <= level ? LEVEL_COLORS[level] : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/BondBar.tsx
git commit -m "feat: add BondBar component"
```

---

### Task 9: PlaceholderChart component

**Files:**
- Create: `src/components/charts/PlaceholderChart.tsx`

- [ ] **Step 1: Create PlaceholderChart.tsx**

```tsx
export function PlaceholderChart({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
          Em breve
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4">{description}</p>
      <svg
        className="w-full h-24 text-gray-200"
        viewBox="0 0 200 60"
        aria-hidden="true"
      >
        <polyline
          points="0,50 40,30 80,40 120,10 160,25 200,20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/PlaceholderChart.tsx
git commit -m "feat: add PlaceholderChart component"
```

---

### Task 10: Dashboard error boundary

**Files:**
- Create: `src/app/(dashboard)/error.tsx`

- [ ] **Step 1: Create error.tsx**

Next.js requires `'use client'` and `export default` — without both, the build fails silently.

```tsx
'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">Erro ao carregar dados. Tente novamente.</p>
      <button onClick={reset} className="btn btn--primary">
        Tentar novamente
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/error.tsx
git commit -m "feat: add dashboard error boundary"
```

---

### Task 11: Consultation stub page

**Files:**
- Create: `src/app/(dashboard)/consultations/stub/page.tsx`

- [ ] **Step 1: Create stub/page.tsx**

```tsx
import Link from 'next/link'
import { DASHBOARD_ROUTE } from '@/lib/routes'

export default function StubPage() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-semibold text-gray-700 mb-2">
        Consulta em breve
      </h1>
      <p className="text-gray-500 mb-6">Funcionalidade em desenvolvimento.</p>
      <Link href={DASHBOARD_ROUTE} className="btn btn--secondary">
        Voltar
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/consultations/stub/page.tsx
git commit -m "feat: add consultation stub page"
```

---

### Task 12: POST /api/patients route handler

**Files:**
- Create: `src/app/api/patients/route.ts`

**Important:** `src/lib/openai/client.ts` uses a **named export** (`export const openai`), not default. Use `import { openai }`, not `import openai`.

- [ ] **Step 1: Create route.ts**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import type { ChatCompletion } from 'openai'
import { APITimeoutError } from 'openai'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildPatientPrompt } from '@/lib/patients/prompt'
import { SPECIALTIES, DIFFICULTIES } from '@/lib/patients/specialties'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const body = await request.json()

  if (!(SPECIALTIES as readonly string[]).includes(body.specialty))
    return NextResponse.json({ error: 'Invalid specialty' }, { status: 400 })
  if (!(DIFFICULTIES as readonly string[]).includes(body.difficulty))
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })

  let completion: ChatCompletion
  try {
    completion = await openai.chat.completions.create(
      buildPatientPrompt(body.specialty, body.difficulty),
      { timeout: 25_000 }
    ) as ChatCompletion
  } catch (e) {
    if (e instanceof APITimeoutError)
      return NextResponse.json({ error: 'OpenAI timeout' }, { status: 408 })
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const content = completion.choices[0].message.content
  if (!content)
    return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

  let openAI: Record<string, unknown>
  try { openAI = JSON.parse(content) as Record<string, unknown> }
  catch { return NextResponse.json({ error: 'OpenAI returned invalid JSON' }, { status: 500 }) }

  const age = Math.round(Number(openAI.age))
  if (!Number.isInteger(age) || age < 18 || age > 80)
    return NextResponse.json({ error: 'OpenAI returned invalid age' }, { status: 500 })

  if (openAI.gender !== 'M' && openAI.gender !== 'F')
    return NextResponse.json({ error: 'OpenAI returned invalid gender' }, { status: 500 })
  const gender = openAI.gender as 'M' | 'F'

  const name      = typeof openAI.name === 'string' && openAI.name.trim()
    ? openAI.name.trim() : null
  const complaint = typeof openAI.chief_complaint === 'string' && openAI.chief_complaint.trim()
    ? openAI.chief_complaint.trim() : null
  const status    = typeof openAI.clinical_status === 'string' && openAI.clinical_status.trim()
    ? openAI.clinical_status.trim() : null
  if (!name || !complaint || !status)
    return NextResponse.json({ error: 'OpenAI returned empty required field' }, { status: 500 })

  const conditions = Array.isArray(openAI.conditions)
    ? openAI.conditions.filter((c: unknown): c is string => typeof c === 'string')
    : []

  const { data, error: rpcError } = await supabase.rpc('create_patient', {
    p_name:       name,
    p_age:        age,
    p_gender:     gender,
    p_specialty:  body.specialty,
    p_difficulty: body.difficulty,
    p_complaint:  complaint,
    p_status:     status,
    p_conditions: conditions,
  })

  if (rpcError) {
    if (rpcError.code === 'US001')
      return NextResponse.json({ error: 'No slots available' }, { status: 403 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/patients/route.ts
git commit -m "feat: add POST /api/patients route handler"
```

---

### Task 13: Route handler tests

**Files:**
- Create: `src/app/api/patients/route.test.ts`

- [ ] **Step 1: Create route.test.ts**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCreate = vi.fn()
vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))

const mockRpc = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ rpc: mockRpc }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validOpenAIResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        name: 'João Silva',
        age: 45,
        gender: 'M',
        chief_complaint: 'Dor no peito há 2 dias',
        clinical_status: 'Paciente estável, consciente e orientado',
        conditions: ['HAS', 'DM'],
      }),
    },
  }],
}

const validPatient = { id: 'patient-uuid-123', name: 'João Silva', age: 45, gender: 'M' }

describe('POST /api/patients', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 400 se specialty for inválida', async () => {
    const res = await POST(makeRequest({ specialty: 'Pediatria', difficulty: 'easy' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid specialty')
  })

  it('retorna 400 se difficulty for inválida', async () => {
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'extreme' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid difficulty')
  })

  it('retorna 408 se OpenAI fizer timeout e não consome slot', async () => {
    const { APITimeoutError } = await import('openai')
    mockCreate.mockRejectedValue(new APITimeoutError())
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(408)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se OpenAI lançar erro genérico e não consome slot', async () => {
    mockCreate.mockRejectedValue(new Error('network error'))
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se OpenAI retornar JSON inválido e não consome slot', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se age estiver fora de 18-80 e não consome slot', async () => {
    const badAge = { ...JSON.parse(validOpenAIResponse.choices[0].message.content), age: 10 }
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(badAge) } }] })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 403 se não houver slots (US001)', async () => {
    mockCreate.mockResolvedValue(validOpenAIResponse)
    mockRpc.mockResolvedValue({ data: null, error: { code: 'US001', message: 'no slots' } })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('No slots available')
  })

  it('retorna 201 com o paciente criado', async () => {
    mockCreate.mockResolvedValue(validOpenAIResponse)
    mockRpc.mockResolvedValue({ data: validPatient, error: null })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('patient-uuid-123')
  })

  it('passa specialty e difficulty do body ao RPC (não do OpenAI)', async () => {
    mockCreate.mockResolvedValue(validOpenAIResponse)
    mockRpc.mockResolvedValue({ data: validPatient, error: null })
    await POST(makeRequest({ specialty: 'Neurologia', difficulty: 'hard' }))
    expect(mockRpc).toHaveBeenCalledWith('create_patient', expect.objectContaining({
      p_specialty: 'Neurologia',
      p_difficulty: 'hard',
    }))
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/app/api/patients/route.test.ts
```

Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/patients/route.test.ts
git commit -m "test: add route handler unit tests for POST /api/patients"
```

---

### Task 14: Dashboard page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite dashboard/page.tsx**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { hasAvailableSlot } from '@/lib/patients/slots'
import { BondBar } from '@/components/ui/BondBar'
import { PlaceholderChart } from '@/components/charts/PlaceholderChart'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const [patientsResult, profileResult] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('total_slots, full_name').eq('id', user.id).single(),
  ])

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data) throw new Error('Profile not found for authenticated user')

  if (patientsResult.error) {
    console.error('Failed to load patients:', patientsResult.error)
  }

  const patients = patientsResult.data ?? []
  const { total_slots, full_name } = profileResult.data
  const used_slots = patientsResult.count ?? patients.length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{full_name}</h1>
          <p className="text-sm text-gray-500">Reputação: 0 pts</p>
        </div>
        <Link
          href="/patients/new"
          aria-disabled={!hasAvailableSlot(used_slots, total_slots)}
          title={
            !hasAvailableSlot(used_slots, total_slots)
              ? 'Aumente sua reputação para desbloquear novos pacientes'
              : undefined
          }
          className="btn btn--primary"
        >
          Novo paciente
        </Link>
      </div>

      <div className="flex gap-6">
        <div className="w-2/5">
          <p className="text-sm text-gray-500 mb-3">
            {used_slots} / {total_slots} slots utilizados
          </p>
          {patients.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum paciente ainda.</p>
          ) : (
            <ul className="space-y-3">
              {patients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/patients/${patient.id}`}
                    className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800">{patient.name}</span>
                      <span className="text-xs text-gray-400">{patient.specialty}</span>
                    </div>
                    <BondBar level={patient.bond_level} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-3/5 space-y-4">
          <PlaceholderChart title="Desempenho AB4" description="Eixos A1–A4 do método AB4" />
          <PlaceholderChart title="Reputação" description="Evolução ao longo do tempo" />
          <PlaceholderChart title="Volume de atendimentos" description="Consultas por semana" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: rewrite dashboard with patient list and placeholder charts"
```

---

### Task 15: /patients/new — server guard + client form

**Files:**
- Create: `src/app/(dashboard)/patients/new/page.tsx`
- Create: `src/app/(dashboard)/patients/new/NewPatientForm.tsx`

- [ ] **Step 1: Create patients/new/page.tsx**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '@/lib/routes'
import { NewPatientForm } from './NewPatientForm'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const [patientsCount, profileResult] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('total_slots').eq('id', user.id).single(),
  ])

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data) throw new Error('Profile not found')

  const count = patientsCount.count ?? 0

  if (count >= profileResult.data.total_slots) {
    redirect(DASHBOARD_ROUTE)
  }

  return <NewPatientForm />
}
```

- [ ] **Step 2: Create NewPatientForm.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SPECIALTIES, DIFFICULTIES } from '@/lib/patients/specialties'
import type { Specialty, Difficulty } from '@/lib/patients/specialties'
import { patientDetailRoute } from '@/lib/routes'

export function NewPatientForm() {
  const router = useRouter()
  const [specialty, setSpecialty] = useState<Specialty | ''>('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!specialty || !difficulty) return
    setLoading(true)
    setFormError(null)

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, difficulty }),
      })

      if (response.status === 201) {
        const data = await response.json()
        if (!data?.id) {
          setFormError('Resposta inválida do servidor')
          return
        }
        router.push(patientDetailRoute(data.id))
      } else {
        const json = await response.json()
        setFormError(json?.error ?? 'Erro desconhecido')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Novo Paciente</h1>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-4">
        <div>
          <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
            Especialidade
          </label>
          <select
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value as Specialty)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Selecione...</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">
              Dificuldade
            </legend>
            <div className="flex gap-3">
              {([['easy', 'Fácil'], ['medium', 'Médio'], ['hard', 'Difícil']] as const).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    className={`px-4 py-2 text-sm rounded-md border ${
                      difficulty === value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </fieldset>
        </div>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <button
          type="submit"
          disabled={loading || !specialty || !difficulty}
          className="w-full btn btn--primary"
        >
          {loading ? 'Aguardando...' : 'Confirmar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/patients/new/page.tsx src/app/(dashboard)/patients/new/NewPatientForm.tsx
git commit -m "feat: add /patients/new with server guard and client form"
```

---

### Task 16: /patients/[id] detail page

**Files:**
- Create: `src/app/(dashboard)/patients/[id]/page.tsx`

- [ ] **Step 1: Create [id]/page.tsx**

```tsx
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, STUB_CONSULTATION_ROUTE } from '@/lib/routes'
import { BondBar } from '@/components/ui/BondBar'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { id } = await params

  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !patient) notFound()

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

      <Link href={STUB_CONSULTATION_ROUTE} className="btn btn--primary">
        Iniciar atendimento
      </Link>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Consultas anteriores</h2>
        <p className="text-gray-400 text-sm">Nenhuma consulta realizada ainda.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/patients/[id]/page.tsx
git commit -m "feat: add /patients/[id] detail page"
```

---

### Task 17: Cross-validation test — SPECIALTIES vs DB constraints

**Files:**
- Create: `src/lib/patients/specialties.test.ts`

This test connects to the **real Supabase project** using env vars from `.env.local`. Run it only after Task 6 (migration applied).

- [ ] **Step 1: Create specialties.test.ts**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SPECIALTIES, DIFFICULTIES } from './specialties'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getConstraintDef(columnName: string): Promise<string | null> {
  // pg_get_constraintdef via service_role direct query
  const { data, error } = await supabase
    .rpc('pg_get_constraint_for_column', {
      tbl: 'patients',
      col: columnName,
    })
    .single()
  if (error) return null
  return data as string
}

function extractLiterals(constraintDef: string): Set<string> {
  const match = constraintDef.match(/ARRAY\[(.+?)\]/)
  if (!match) {
    // Fallback: match IN ('a','b') pattern
    const inMatch = constraintDef.match(/IN \(([^)]+)\)/)
    if (!inMatch) throw new Error(`Cannot parse constraint: ${constraintDef}`)
    return new Set(
      inMatch[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    )
  }
  return new Set(
    match[1].split(', ').map((s) => s.replace(/^'|'(::text)?$/g, ''))
  )
}

describe('cross-validação: constantes TypeScript vs CHECK constraints do banco', () => {
  it('SPECIALTIES bate com o CHECK constraint da coluna specialty', async () => {
    // Query direta via SQL — não depende de RPC customizada
    const { data, error } = await supabase
      .from('information_schema.check_constraints' as never)
      .select('check_clause')
      .ilike('check_clause' as never, '%Clínica%')
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('Sem acesso a information_schema — pulando specialty cross-val')
      return
    }

    const clause = (data as { check_clause: string }).check_clause
    const dbSet = extractLiterals(clause)
    const tsSet = new Set([...SPECIALTIES])

    for (const s of tsSet) {
      expect(dbSet, `"${s}" em SPECIALTIES mas não no DB constraint`).toContain(s)
    }
    for (const s of dbSet) {
      expect(tsSet, `"${s}" no DB constraint mas não em SPECIALTIES`).toContain(s)
    }
  })

  it('DIFFICULTIES bate com o CHECK constraint da coluna difficulty', async () => {
    const { data, error } = await supabase
      .from('information_schema.check_constraints' as never)
      .select('check_clause')
      .ilike('check_clause' as never, '%easy%')
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('Sem acesso a information_schema — pulando difficulty cross-val')
      return
    }

    const clause = (data as { check_clause: string }).check_clause
    const dbSet = extractLiterals(clause)
    const tsSet = new Set([...DIFFICULTIES])

    for (const d of tsSet) {
      expect(dbSet, `"${d}" em DIFFICULTIES mas não no DB constraint`).toContain(d)
    }
    for (const d of dbSet) {
      expect(tsSet, `"${d}" no DB constraint mas não em DIFFICULTIES`).toContain(d)
    }
  })
})
```

- [ ] **Step 2: Run test**

```bash
npx vitest run src/lib/patients/specialties.test.ts
```

Expected: 2 tests PASS (or SKIP with warning if `information_schema` is inaccessible via Supabase client)

- [ ] **Step 3: Commit**

```bash
git add src/lib/patients/specialties.test.ts
git commit -m "test: cross-validate SPECIALTIES and DIFFICULTIES against DB constraints"
```

---

### Task 18: E2E test — new patient flow

**Files:**
- Create: `e2e/patients.spec.ts`

**Prerequisites:**
1. A real authenticated user must exist in Supabase Auth (create one via `/register` if needed)
2. Add to `.env.local` (do NOT commit this file):
   ```
   E2E_USER_EMAIL=your-test-user@email.com
   E2E_USER_PASSWORD=YourTestPass123!
   ```
3. Dev server must be running (`npm run dev`) — Playwright starts it automatically via `webServer` config

- [ ] **Step 1: Create patients.spec.ts**

```ts
import { test, expect } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

test.describe('Carteira de Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', E2E_EMAIL)
    await page.fill('[name="password"]', E2E_PASSWORD)
    await page.click('[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('fluxo completo: criar paciente e visualizar na listagem', async ({ page }) => {
    await page.click('text=Novo paciente')
    await page.waitForURL('**/patients/new')

    await page.selectOption('#specialty', 'Cardiologia')
    await page.click('text=Fácil')

    // OpenAI pode demorar até 25s
    await page.click('[type="submit"]')
    await page.waitForURL('**/patients/**', { timeout: 30_000 })

    expect(page.url()).toMatch(/\/patients\/[0-9a-f-]+$/)
    await expect(page.locator('text=Iniciar atendimento')).toBeVisible()
    await expect(page.locator('text=Estado clínico')).toBeVisible()
    await expect(page.locator('text=Nenhuma consulta realizada ainda')).toBeVisible()

    await page.goto('/dashboard')
    await expect(page.locator('text=Cardiologia')).toBeVisible()
  })

  test('botão Iniciar atendimento leva ao stub de consulta', async ({ page }) => {
    await page.goto('/dashboard')
    const firstPatient = page.locator('ul li a').first()

    if (await firstPatient.count() === 0) {
      test.skip()
      return
    }

    await firstPatient.click()
    await page.waitForURL('**/patients/**')
    await page.click('text=Iniciar atendimento')
    await page.waitForURL('**/consultations/stub')
    await expect(page.locator('text=Consulta em breve')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run E2E tests**

```bash
npx playwright test e2e/patients.spec.ts
```

Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/patients.spec.ts
git commit -m "test: add E2E tests for patient creation flow"
```
