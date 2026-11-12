# Mapa da Doença — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um recurso onde o aluno digita uma doença e recebe um "mapa" que correlaciona a fisiopatogênese com clínica, diagnóstico e tratamento (visual + texto curto), salvo na sua biblioteca.

**Architecture:** Reutiliza o padrão de geração estruturada por IA do app (simulados): `openai.chat.completions.create` com `response_format: json_object`, um prompt que força cada achado/exame/conduta a carregar seu "porquê" mecanístico, e um parser que valida o objeto. Rota API faz o gate (1 grátis → Premium) contando os mapas do usuário, gera, salva em `disease_maps` (RLS por usuário) e devolve. A UI é uma página de busca livre que renderiza o mapa + texto e lista os mapas salvos.

**Tech Stack:** Next.js 16 (App Router, server components + client islands), Supabase (Postgres + RLS), OpenAI (`@/lib/openai/client`), Tailwind (tokens do app), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-mapa-da-doenca-design.md`

## Global Constraints

- **Idioma:** todo conteúdo e UI em **pt-BR**.
- **Sem emojis na UI** — usar ícones SVG em linha (padrão do app: `MobileNav`, `PremiumBadge`).
- **Modelo de IA:** `MODELS.generation` (de `@/lib/openai/models`), com `response_format: { type: 'json_object' }` e `{ timeout: 90_000 }`. Importar `openai` de `@/lib/openai/client`. Arquivos de servidor começam com `import 'server-only'`.
- **Acesso:** 1 mapa grátis (lifetime) por usuário; depois Premium. Premium = ilimitado. O gate conta linhas de `disease_maps` do usuário (não usa `consume_ai_call`).
- **Selo fixo** em todo mapa: "Material de estudo — não é conduta clínica."
- **Guard-rail de conteúdo:** foco em mecanismo e correlação; tratamento explica por que a classe/estratégia funciona, **sem doses nem prescrição**.
- **Escopo:** doenças das áreas clínicas já cobertas. Entrada fora de escopo → resposta amigável, nunca um mapa inventado.
- **Deploy:** push para `main` → webhook de deploy (`curl -X POST http://2.25.135.251:3000/api/deploy/bb8c580877a458b31ebb966072962eaa9d519d41c2a7796b`); confirmar por `/api/version` (builtAt). Migrations aplicadas pelo SQL editor do Supabase (projeto ref `zrgjsgorijqlqhvlrpdh`), verificadas por REST com o service role.
- **Rota do app:** `/mapa`. **Tabela:** `disease_maps`.

---

## File Structure

- `supabase/migrations/20261111160000_disease_maps.sql` — tabela `disease_maps` + RLS.
- `src/lib/disease-map/schema.ts` — tipos `DiseaseMap`/itens + `parseDiseaseMap(raw)`.
- `src/lib/disease-map/schema.test.ts` — testes do parser.
- `src/lib/disease-map/prompt.ts` — `DISEASE_MAP_AREAS` + `buildDiseaseMapPrompt(disease)`.
- `src/lib/disease-map/prompt.test.ts` — testes do prompt.
- `src/lib/disease-map/generate.ts` — `generateDiseaseMap(disease)` (chama a OpenAI).
- `src/app/api/disease-map/generate/route.ts` — POST: auth + gate + gera + salva + retorna.
- `src/app/(dashboard)/mapa/page.tsx` — server component: lista mapas salvos + monta o gerador.
- `src/app/(dashboard)/mapa/DiseaseMapGenerator.tsx` — client: busca, chama a API, estados.
- `src/app/(dashboard)/mapa/DiseaseMapView.tsx` — render do mapa (núcleo + 3 ramos) + texto + compartilhar.
- `src/components/layout/Shell.tsx` (modify) e `src/components/layout/MobileNav.tsx` (modify) — entrada de navegação.

---

### Task 1: Migração `disease_maps`

**Files:**
- Create: `supabase/migrations/20261111160000_disease_maps.sql`

**Interfaces:**
- Produces: tabela `disease_maps(id uuid, user_id uuid, disease text, area text, data jsonb, created_at timestamptz)` com RLS por dono; usada pela rota (Task 4) e pela página (Task 5).

- [ ] **Step 1: Escrever a migração**

```sql
-- Mapas da Doença gerados pelo aluno (resumo centrado na fisiopatogênese).
-- Guarda o objeto estruturado (data jsonb). É a fundação da biblioteca virtual.
CREATE TABLE IF NOT EXISTS disease_maps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disease    TEXT NOT NULL,
  area       TEXT,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS disease_maps_user_created_idx
  ON disease_maps (user_id, created_at DESC);

ALTER TABLE disease_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY disease_maps_select_own ON disease_maps
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY disease_maps_insert_own ON disease_maps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY disease_maps_delete_own ON disease_maps
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar no Supabase (SQL editor)**

Abrir `https://supabase.com/dashboard/project/zrgjsgorijqlqhvlrpdh/sql/new`, colar o SQL, Run (confirmar o modal "Run query" se aparecer — o `CREATE POLICY ... FOR DELETE` dispara o modal).

- [ ] **Step 3: Verificar por REST (service role lido do .env.local, nunca ecoar)**

Run:
```bash
SRK=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
curl -s -o /dev/null -w "%{http_code}\n" "https://zrgjsgorijqlqhvlrpdh.supabase.co/rest/v1/disease_maps?select=id&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261111160000_disease_maps.sql
git commit -m "feat(mapa): migração disease_maps (RLS por dono)"
```

---

### Task 2: Schema + parser (`DiseaseMap`)

**Files:**
- Create: `src/lib/disease-map/schema.ts`
- Test: `src/lib/disease-map/schema.test.ts`

**Interfaces:**
- Produces:
  - `type CorrelationItem = { label: string; because: string }`
  - `type DiseaseMap = { disease: string; area: string; core: { mechanism: string; detail: string }[]; clinica: CorrelationItem[]; diagnostico: CorrelationItem[]; tratamento: CorrelationItem[]; summary: string }`
  - `parseDiseaseMap(raw: string): DiseaseMap | { outOfScope: true } | null` — `null` = JSON inválido/incompleto; `{outOfScope:true}` quando o modelo sinaliza fora de escopo.

- [ ] **Step 1: Escrever os testes**

```typescript
import { describe, it, expect } from 'vitest'
import { parseDiseaseMap } from './schema'

const valid = JSON.stringify({
  disease: 'Insuficiência cardíaca',
  area: 'Cardiologia',
  core: [{ mechanism: 'Falência de bomba do VE', detail: 'queda do débito e congestão retrógrada' }],
  clinica: [{ label: 'Turgência jugular e B3', because: 'congestão venosa sistêmica pela falência do VE' }],
  diagnostico: [{ label: 'BNP elevado; eco com FE reduzida', because: 'estiramento miocárdico e disfunção sistólica' }],
  tratamento: [{ label: 'Diurético de alça', because: 'reduz a congestão gerada pelo mecanismo' }],
  summary: 'A falha do VE gera congestão, que explica os achados e a resposta ao diurético.',
})

describe('parseDiseaseMap', () => {
  it('aceita um objeto completo e bem formado', () => {
    const m = parseDiseaseMap(valid)
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('outOfScope')
    if (m && !('outOfScope' in m)) {
      expect(m.disease).toBe('Insuficiência cardíaca')
      expect(m.core.length).toBeGreaterThanOrEqual(1)
      expect(m.clinica[0].because).toBeTruthy()
    }
  })

  it('rejeita item sem "because" (correlação não pode faltar)', () => {
    const o = JSON.parse(valid); o.clinica = [{ label: 'Dispneia', because: '' }]
    expect(parseDiseaseMap(JSON.stringify(o))).toBeNull()
  })

  it('rejeita quando falta uma seção obrigatória', () => {
    const o = JSON.parse(valid); delete o.tratamento
    expect(parseDiseaseMap(JSON.stringify(o))).toBeNull()
  })

  it('sinaliza fora de escopo', () => {
    expect(parseDiseaseMap(JSON.stringify({ error: 'out_of_scope' }))).toEqual({ outOfScope: true })
  })

  it('retorna null para JSON inválido', () => {
    expect(parseDiseaseMap('not json')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run src/lib/disease-map/schema.test.ts`
Expected: FAIL (`parseDiseaseMap` não existe).

- [ ] **Step 3: Implementar o schema/parser**

```typescript
export type CorrelationItem = { label: string; because: string }
export type CoreMechanism = { mechanism: string; detail: string }
export type DiseaseMap = {
  disease: string
  area: string
  core: CoreMechanism[]
  clinica: CorrelationItem[]
  diagnostico: CorrelationItem[]
  tratamento: CorrelationItem[]
  summary: string
}

function cleanItems(v: unknown): CorrelationItem[] | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const items = v
    .filter((i): i is CorrelationItem =>
      !!i && typeof i.label === 'string' && i.label.trim() !== ''
      && typeof i.because === 'string' && i.because.trim() !== '')
    .map((i) => ({ label: i.label.trim(), because: i.because.trim() }))
  return items.length ? items : null
}

export function parseDiseaseMap(raw: string): DiseaseMap | { outOfScope: true } | null {
  let o: Record<string, unknown>
  try { o = JSON.parse(raw) } catch { return null }
  if (o && (o as { error?: string }).error === 'out_of_scope') return { outOfScope: true }

  const core = Array.isArray(o.core)
    ? (o.core as CoreMechanism[])
        .filter((c) => c && typeof c.mechanism === 'string' && c.mechanism.trim() !== '')
        .map((c) => ({ mechanism: c.mechanism.trim(), detail: typeof c.detail === 'string' ? c.detail.trim() : '' }))
        .slice(0, 3)
    : []
  const clinica = cleanItems(o.clinica)
  const diagnostico = cleanItems(o.diagnostico)
  const tratamento = cleanItems(o.tratamento)
  const disease = typeof o.disease === 'string' ? o.disease.trim() : ''
  const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
  const area = typeof o.area === 'string' ? o.area.trim() : ''

  if (!disease || !summary || core.length === 0 || !clinica || !diagnostico || !tratamento) return null
  return { disease, area, core, clinica, diagnostico, tratamento, summary }
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run src/lib/disease-map/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/disease-map/schema.ts src/lib/disease-map/schema.test.ts
git commit -m "feat(mapa): schema + parser do DiseaseMap (força correlação item↔mecanismo)"
```

---

### Task 3: Prompt + geração

**Files:**
- Create: `src/lib/disease-map/prompt.ts`
- Test: `src/lib/disease-map/prompt.test.ts`
- Create: `src/lib/disease-map/generate.ts`

**Interfaces:**
- Consumes: `parseDiseaseMap` (Task 2); `openai`, `MODELS` (libs do app).
- Produces:
  - `DISEASE_MAP_AREAS: string[]` (as 9 áreas clínicas).
  - `buildDiseaseMapPrompt(disease: string): string`.
  - `generateDiseaseMap(disease: string): Promise<DiseaseMap | { outOfScope: true } | null>`.

- [ ] **Step 1: Escrever os testes do prompt**

```typescript
import { describe, it, expect } from 'vitest'
import { buildDiseaseMapPrompt } from './prompt'

describe('buildDiseaseMapPrompt', () => {
  it('inclui a doença, exige o "porquê" e as 3 correlações, e pede JSON', () => {
    const p = buildDiseaseMapPrompt('Cirrose hepática')
    expect(p).toContain('Cirrose hepática')
    expect(p).toMatch(/fisiopatog/i)
    for (const k of ['clinica', 'diagnostico', 'tratamento', 'core', 'because', 'summary']) expect(p).toContain(k)
    expect(p).toMatch(/JSON/)
  })
  it('instrui o fora de escopo e proíbe doses', () => {
    const p = buildDiseaseMapPrompt('x')
    expect(p).toMatch(/out_of_scope/)
    expect(p).toMatch(/dose|prescri/i)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx vitest run src/lib/disease-map/prompt.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar o prompt**

```typescript
export const DISEASE_MAP_AREAS = [
  'Clínica Médica', 'Cardiologia', 'Gastroenterologia', 'Pneumologia',
  'Endocrinologia', 'Nefrologia', 'Neurologia', 'Infectologia', 'Hepatologia',
]

export function buildDiseaseMapPrompt(disease: string): string {
  return [
    'Você é um professor de medicina cuja premissa é: quem entende a FISIOPATOGÊNESE entende a clínica, faz o diagnóstico e trata.',
    `Monte um "mapa da doença" para: "${disease}".`,
    '',
    'REGRA CENTRAL: tudo parte do mecanismo. Para CADA achado clínico, exame e conduta, explique o "porquê" ligando-o ao núcleo fisiopatológico. Nunca liste sem o porquê.',
    `Classifique a "area" em uma destas: ${DISEASE_MAP_AREAS.join(', ')}.`,
    '',
    'Conteúdo:',
    '- core: 1 a 3 mecanismos-chave (a origem de tudo). Cada um: {mechanism, detail}.',
    '- clinica: achados/sinais/sintomas; cada item {label, because} — because liga o achado ao mecanismo.',
    '- diagnostico: exames/achados de exame; cada item {label, because} — o que o mecanismo faz aparecer.',
    '- tratamento: condutas/estratégias; cada item {label, because} — QUE ELO do mecanismo a conduta ataca. Explique por que a CLASSE funciona; NÃO cite doses nem prescrição detalhada.',
    '- summary: um texto curto (3-5 frases) que encadeia mecanismo → clínica → diagnóstico → tratamento.',
    'Nível: estudante de medicina. Conciso. Português do Brasil.',
    '',
    `Se "${disease}" NÃO for uma doença/condição reconhecível da clínica médica, responda SOMENTE: {"error":"out_of_scope"}.`,
    '',
    'Responda SOMENTE um JSON válido no formato:',
    '{"disease":"...","area":"...","core":[{"mechanism":"...","detail":"..."}],"clinica":[{"label":"...","because":"..."}],"diagnostico":[{"label":"...","because":"..."}],"tratamento":[{"label":"...","because":"..."}],"summary":"..."}',
  ].join('\n')
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx vitest run src/lib/disease-map/prompt.test.ts`
Expected: PASS

- [ ] **Step 5: Implementar a geração**

```typescript
import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildDiseaseMapPrompt } from './prompt'
import { parseDiseaseMap, type DiseaseMap } from './schema'

export async function generateDiseaseMap(
  disease: string,
): Promise<DiseaseMap | { outOfScope: true } | null> {
  const completion = await openai.chat.completions.create({
    model: MODELS.generation,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildDiseaseMapPrompt(disease) }],
  }, { timeout: 90_000 })
  const raw = completion.choices[0]?.message?.content
  return raw ? parseDiseaseMap(raw) : null
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

```bash
git add src/lib/disease-map/prompt.ts src/lib/disease-map/prompt.test.ts src/lib/disease-map/generate.ts
git commit -m "feat(mapa): prompt (correlação obrigatória, fora de escopo) + geração por IA"
```

---

### Task 4: Rota de geração (gate 1 grátis → Premium + salvar)

**Files:**
- Create: `src/app/api/disease-map/generate/route.ts`

**Interfaces:**
- Consumes: `generateDiseaseMap` (Task 3); tabela `disease_maps` (Task 1); `createClient` de `@/lib/supabase/server`.
- Produces: `POST /api/disease-map/generate` body `{ disease: string }` →
  - 200 `{ map: DiseaseMap, id: string }`
  - 400 `{ error: 'invalid' }` (entrada vazia)
  - 401 `{ error: 'Unauthorized' }`
  - 403 `{ error: 'premium_required' }` (free já usou 1)
  - 422 `{ error: 'out_of_scope' }`
  - 502 `{ error: 'generation_failed' }`

- [ ] **Step 1: Implementar a rota**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { generateDiseaseMap } from '@/lib/disease-map/generate'

export const dynamic = 'force-dynamic'

const FREE_MAP_LIMIT = 1

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { disease?: string }
  const disease = (body.disease ?? '').trim()
  if (!disease) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const db = supabase as unknown as SupabaseClient

  // Gate: grátis tem 1 mapa (lifetime); Premium é ilimitado.
  const { data: prof } = await db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle()
  const isPremium = !!(prof as { is_premium?: boolean } | null)?.is_premium
  if (!isPremium) {
    const { count } = await db.from('disease_maps').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= FREE_MAP_LIMIT) {
      return NextResponse.json({ error: 'premium_required', message: 'Você já usou seu mapa grátis. Assine o Premium para mapas ilimitados.' }, { status: 403 })
    }
  }

  const result = await generateDiseaseMap(disease)
  if (!result) return NextResponse.json({ error: 'generation_failed', message: 'Não foi possível gerar o mapa. Tente de novo.' }, { status: 502 })
  if ('outOfScope' in result) {
    return NextResponse.json({ error: 'out_of_scope', message: 'Não reconheci isso como uma doença da clínica médica. Tente outro nome.' }, { status: 422 })
  }

  const { data: saved, error } = await db
    .from('disease_maps')
    .insert({ user_id: user.id, disease: result.disease, area: result.area, data: result } as never)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 })

  return NextResponse.json({ map: result, id: (saved as { id: string }).id }, { status: 200 })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/disease-map/generate/route.ts
git commit -m "feat(mapa): rota de geração com gate 1-grátis→Premium e salvamento"
```

---

### Task 5: UI — página, gerador e render do mapa

**Files:**
- Create: `src/app/(dashboard)/mapa/DiseaseMapView.tsx`
- Create: `src/app/(dashboard)/mapa/DiseaseMapGenerator.tsx`
- Create: `src/app/(dashboard)/mapa/page.tsx`

**Interfaces:**
- Consumes: `POST /api/disease-map/generate` (Task 4); tipo `DiseaseMap` (Task 2); tabela `disease_maps` (Task 1).
- Produces: rota `/mapa` (server component) que lista os mapas salvos e embute o gerador.

- [ ] **Step 1: `DiseaseMapView` (render do mapa + texto + compartilhar)**

```tsx
'use client'
import type { DiseaseMap, CorrelationItem } from '@/lib/disease-map/schema'

const GOLD = '#E7B23A'

function Branch({ title, items }: { title: string; items: CorrelationItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <ul className="mt-2 space-y-2.5">
        {items.map((it, i) => (
          <li key={i}>
            <p className="text-sm font-medium text-ink">{it.label}</p>
            <p className="mt-0.5 text-xs text-muted"><span className="font-semibold" style={{ color: 'var(--cyan, #22D3EE)' }}>porquê:</span> {it.because}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DiseaseMapView({ map }: { map: DiseaseMap }) {
  async function share() {
    const text = `Mapa da Doença — ${map.disease}\n\n${map.summary}\n\nvia Med Mind`
    try {
      if (navigator.share) await navigator.share({ title: `Mapa — ${map.disease}`, text })
      else await navigator.clipboard.writeText(text)
    } catch { /* cancelado */ }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">{map.disease}</h2>
          {map.area && <span className="text-xs font-medium text-muted">{map.area}</span>}
        </div>
        <button onClick={share} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-primary">Compartilhar</button>
      </div>

      {/* Núcleo fisiopatológico */}
      <div className="rounded-xl border p-4" style={{ borderColor: `${GOLD}44`, background: 'rgba(231,178,58,.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>Núcleo fisiopatológico</h3>
        <ul className="mt-2 space-y-1.5">
          {map.core.map((c, i) => (
            <li key={i} className="text-sm text-ink"><b>{c.mechanism}</b>{c.detail ? <span className="text-muted"> — {c.detail}</span> : null}</li>
          ))}
        </ul>
      </div>

      {/* Ramos */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Branch title="Clínica" items={map.clinica} />
        <Branch title="Diagnóstico" items={map.diagnostico} />
        <Branch title="Tratamento" items={map.tratamento} />
      </div>

      {/* Texto mecanístico */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Em resumo</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{map.summary}</p>
      </div>

      <p className="text-center text-[11px] text-muted">Material de estudo — não é conduta clínica.</p>
    </div>
  )
}
```

- [ ] **Step 2: `DiseaseMapGenerator` (busca + estados)**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { DiseaseMap } from '@/lib/disease-map/schema'
import { DiseaseMapView } from './DiseaseMapView'

const SUGGESTIONS = ['Insuficiência cardíaca', 'Cirrose hepática', 'Lúpus eritematoso sistêmico', 'DPOC', 'Cetoacidose diabética']

export function DiseaseMapGenerator() {
  const router = useRouter()
  const [disease, setDisease] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [premium, setPremium] = useState(false)
  const [map, setMap] = useState<DiseaseMap | null>(null)

  async function run(value: string) {
    const q = value.trim()
    if (!q || busy) return
    setBusy(true); setError(null); setPremium(false); setMap(null)
    try {
      const res = await fetch('/api/disease-map/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disease: q }),
      })
      const data = await res.json().catch(() => ({})) as { map?: DiseaseMap; error?: string; message?: string }
      if (res.ok && data.map) { setMap(data.map); router.refresh(); return } // refresh atualiza a lista salva
      if (res.status === 403) { setPremium(true); return }
      setError(data.message ?? 'Não foi possível gerar. Tente de novo.')
    } catch { setError('Erro de conexão.') } finally { setBusy(false) }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); run(disease) }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={disease} onChange={(e) => setDisease(e.target.value)}
            placeholder="Digite uma doença… (ex.: Insuficiência cardíaca)"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button type="submit" disabled={busy || !disease.trim()}
            className="rounded-xl px-6 py-3 text-sm font-bold text-[#1a1203] disabled:opacity-50" style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>
            {busy ? 'Gerando…' : 'Gerar mapa'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button type="button" key={s} onClick={() => { setDisease(s); run(s) }} disabled={busy}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-ink disabled:opacity-50">{s}</button>
          ))}
        </div>
      </form>

      {premium && (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#E7B23A66', background: 'rgba(231,178,58,.08)' }}>
          <p className="text-sm font-semibold text-ink">Você já usou seu mapa grátis.</p>
          <p className="mt-1 text-xs text-muted">Assine o Premium para gerar mapas ilimitados.</p>
          <Link href="/premium" className="mt-3 inline-block rounded-lg px-4 py-2 text-xs font-bold text-[#1a1203]" style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>Seja Premium</Link>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {map && <DiseaseMapView map={map} />}
    </div>
  )
}
```

- [ ] **Step 3: `page.tsx` (server: lista salvos + gerador)**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { DiseaseMapGenerator } from './DiseaseMapGenerator'

export const dynamic = 'force-dynamic'

export default async function MapaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  const { data: saved } = await db
    .from('disease_maps').select('id, disease, area, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  const maps = (saved ?? []) as { id: string; disease: string; area: string | null; created_at: string }[]

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Mapa da Doença</h1>
        <p className="mt-2 max-w-xl text-muted">Entenda a doença pela fisiopatogênese — e veja a clínica, o diagnóstico e o tratamento saírem do mecanismo. Digite uma doença e gere o mapa.</p>
      </header>

      <DiseaseMapGenerator />

      {maps.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Seus mapas</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {maps.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-ink">{m.disease}</p>
                {m.area && <p className="text-xs text-muted">{m.area}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/mapa/"
git commit -m "feat(mapa): página /mapa com busca, render do mapa (núcleo+3 ramos) e lista salva"
```

---

### Task 6: Navegação para `/mapa`

**Files:**
- Modify: `src/components/layout/Shell.tsx`
- Modify: `src/components/layout/MobileNav.tsx`

**Interfaces:**
- Consumes: rota `/mapa` (Task 5).

- [ ] **Step 1: Shell — adicionar link (desktop) após "Resultados"**

Localizar a linha do link `/resultados` em `src/components/layout/Shell.tsx` e inserir logo depois:

```tsx
<Link href="/mapa" className="text-xs font-medium text-muted transition-colors hover:text-primary">Mapa</Link>
```

- [ ] **Step 2: MobileNav — incluir "Mapa" nos ITEMS**

Em `src/components/layout/MobileNav.tsx`, adicionar ao array `ITEMS` (ícone de documento/mapa):

```tsx
{ href: '/mapa', label: 'Mapa', icon: 'M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3V7' },
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

```bash
git add src/components/layout/Shell.tsx src/components/layout/MobileNav.tsx
git commit -m "feat(mapa): acesso ao /mapa na navegação (desktop + mobile)"
```

---

### Task 7: Build, deploy e verificação end-to-end

**Files:** nenhum (operacional).

- [ ] **Step 1: Suite de testes**

Run: `npm test`
Expected: PASS (inclui os novos testes de schema e prompt).

- [ ] **Step 2: Push + deploy**

```bash
git push origin main
curl -s -X POST "http://2.25.135.251:3000/api/deploy/bb8c580877a458b31ebb966072962eaa9d519d41c2a7796b" -w "\nHTTP %{http_code}\n"
```
Expected: `HTTP 200`.

- [ ] **Step 3: Confirmar novo build**

Run (poll até `builtAt` mudar): `curl -s https://medmindedu.com.br/api/version`
Expected: `builtAt` mais recente que o anterior.

- [ ] **Step 4: Verificação manual (logado)**

Abrir `app.medmindedu.com.br/mapa`, gerar "Insuficiência cardíaca", confirmar: núcleo + 3 ramos com "porquê" em cada item, texto resumo, selo de estudo, e o mapa aparecendo em "Seus mapas". Com conta grátis que já tem 1 mapa, confirmar o upsell Premium.

---

## Self-Review

**Spec coverage:**
- §2 formato visual+texto → Task 5 (DiseaseMapView). ✅
- §2 entrada busca livre → Task 5 (DiseaseMapGenerator). ✅
- §2/§8 1 grátis→Premium → Task 4 (gate por contagem) + Task 5 (upsell). ✅
- §3 objeto de correlação (because obrigatório) → Task 2 (parser rejeita sem because) + Task 3 (prompt). ✅
- §4 geração IA estruturada, escopo, fora-de-escopo → Task 3 + Task 4 (422). ✅
- §5 fluxo → Task 5. ✅
- §7 persistência/biblioteca (salvar + listar) → Task 1 + Task 4 (insert) + Task 5 (lista). ✅
- §9 guard-rails (selo, sem doses, escopo) → Task 3 (prompt) + Task 5 (selo). ✅
- §10 fora de escopo v1 (gatilho pós-caso, toggle, biblioteca completa) → não implementado (correto). ✅

**Placeholder scan:** sem TBD/TODO; todo passo tem código/comando concretos.

**Type consistency:** `DiseaseMap`, `CorrelationItem` definidos na Task 2 e usados igual nas Tasks 3/5; rota (Task 4) retorna `{ map, id }` consumido igual na Task 5; `generateDiseaseMap` assinatura idêntica entre Task 3 e Task 4.
