# Retenção por recurso + Ficha individual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no painel do coordenador **qual recurso mais retém** (curva de retenção D7 + lift por recurso) e enriquecer a **ficha individual** do aluno com o desempenho em todos os recursos.

**Architecture:** Uma lib pura e testável (`src/lib/admin/retention.ts`) recebe uma lista normalizada de usuários (`{id, signup, events[]}`) e calcula maturidade, retenção D7, curva e lift — sem acoplar ao Supabase. O `/admin/page.tsx` (agregado) e o `/admin/[id]/page.tsx` (ficha) montam os eventos a partir das tabelas (service role) e chamam a lib. Server components, `force-dynamic`.

**Tech Stack:** Next.js 16 (server components), Supabase (service role), Vitest, Tailwind (tokens do app).

**Spec:** `docs/superpowers/specs/2026-11-13-retencao-e-ficha-design.md`

## Global Constraints

- **pt-BR** em toda a UI; **sem emojis** (ícones SVG se preciso).
- **Retenção = D7**: retido = atividade ≥ 7 dias após o cadastro. **Maturidade**: só entram usuários cadastrados há ≥ `n` dias para o marco `n`.
- **Avisos fixos na UI**: "N pequeno → direcional, não estatístico" e "lift = correlação, não causa".
- Atividade vem de **eventos reais** (não de `last_sign_in_at`): `consultations`/`patients` (Simulador), `quiz_answers` (Desafio), `exam_attempts` (Simulados), `disease_maps` (Mapas), `posts`/`post_reactions` (Comunidade).
- **Deploy:** push `main` → webhook `curl -X POST http://2.25.135.251:3000/api/deploy/bb8c580877a458b31ebb966072962eaa9d519d41c2a7796b`; confirmar por `/api/version`. Migration pelo SQL editor do Supabase (ref `zrgjsgorijqlqhvlrpdh`), verificada por REST.

---

## File Structure

- `supabase/migrations/20261113180000_exam_attempts_created_at.sql` — `created_at` em `exam_attempts`.
- `src/lib/admin/retention.ts` — tipos + funções puras (maturidade, D7, curva, lift).
- `src/lib/admin/retention.test.ts` — testes.
- `src/components/admin/RetentionSection.tsx` — UI da seção agregada (curva + D7 + tabela de lift). Componente de apresentação (recebe props já calculadas).
- `src/app/(dashboard)/admin/page.tsx` (modify) — monta eventos, chama a lib, renderiza `RetentionSection`.
- `src/app/(dashboard)/admin/[id]/page.tsx` (modify) — blocos por recurso + status de retenção + linha do tempo.

---

### Task 1: Migração `exam_attempts.created_at`

**Files:**
- Create: `supabase/migrations/20261113180000_exam_attempts_created_at.sql`

**Interfaces:**
- Produces: coluna `exam_attempts.created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

- [ ] **Step 1: Escrever a migração**

```sql
-- created_at nos simulados, para entrarem na análise temporal de retenção.
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

- [ ] **Step 2: Aplicar no SQL editor** (`https://supabase.com/dashboard/project/zrgjsgorijqlqhvlrpdh/sql/new`), Run.

- [ ] **Step 3: Verificar por REST**

Run:
```bash
SRK=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
curl -s -o /dev/null -w "%{http_code}\n" "https://zrgjsgorijqlqhvlrpdh.supabase.co/rest/v1/exam_attempts?select=created_at&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261113180000_exam_attempts_created_at.sql
git commit -m "feat(retencao): created_at em exam_attempts"
```

---

### Task 2: Lib de retenção (funções puras + testes)

**Files:**
- Create: `src/lib/admin/retention.ts`
- Test: `src/lib/admin/retention.test.ts`

**Interfaces:**
- Produces:
  - `type Feature = 'simulador'|'desafio'|'simulados'|'mapas'|'social'`
  - `const FEATURES: {key:Feature,label:string}[]`
  - `type UserActivity = { id: string; signup: number; events: { feature: Feature; ts: number }[] }`
  - `isMature(u, now, days=7): boolean`
  - `isRetainedD7(u, now): boolean`
  - `retentionD7(users, now): { eligible:number; retained:number; pct:number }`
  - `retentionCurve(users, now, marks=[1,7,14,30]): { dayMark:number; eligible:number; retained:number; pct:number }[]`
  - `featureLift(users, now): { feature:Feature; label:string; adopters:number; nonAdopters:number; retAdopt:number; retNon:number; lift:number }[]`

- [ ] **Step 1: Escrever os testes**

```typescript
import { describe, it, expect } from 'vitest'
import { isMature, isRetainedD7, retentionD7, retentionCurve, featureLift, type UserActivity } from './retention'

const DAY = 86_400_000
const NOW = 100 * DAY
const at = (dayFromSignup: number, signup: number) => signup + dayFromSignup * DAY

// u1: maduro, usou Desafio no dia 1 e voltou no dia 10 → retido
// u2: maduro, só atividade no dia 0 → não retido
// u3: novo (cadastro há 3 dias) → imaturo
const users: UserActivity[] = [
  { id: 'u1', signup: 0, events: [{ feature: 'desafio', ts: at(1, 0) }, { feature: 'desafio', ts: at(10, 0) }] },
  { id: 'u2', signup: 0, events: [{ feature: 'simulador', ts: at(0, 0) }] },
  { id: 'u3', signup: NOW - 3 * DAY, events: [{ feature: 'desafio', ts: NOW - 2 * DAY }] },
]

describe('maturidade e retenção', () => {
  it('maturidade exige 7 dias desde o cadastro', () => {
    expect(isMature(users[0], NOW)).toBe(true)
    expect(isMature(users[2], NOW)).toBe(false)
  })
  it('retido = atividade 7+ dias após o cadastro', () => {
    expect(isRetainedD7(users[0], NOW)).toBe(true)
    expect(isRetainedD7(users[1], NOW)).toBe(false)
  })
  it('retentionD7 considera só maduros', () => {
    const r = retentionD7(users, NOW)
    expect(r.eligible).toBe(2)   // u1,u2 (u3 imaturo fora)
    expect(r.retained).toBe(1)   // u1
    expect(r.pct).toBe(50)
  })
})

describe('curva', () => {
  it('cada marco só conta quem é elegível', () => {
    const c = retentionCurve(users, NOW)
    const d7 = c.find((p) => p.dayMark === 7)!
    expect(d7.eligible).toBe(2)
    expect(d7.retained).toBe(1)
  })
})

describe('featureLift', () => {
  it('compara retenção de adotantes vs não, ordenado por lift', () => {
    const rows = featureLift(users, NOW)
    const desafio = rows.find((r) => r.feature === 'desafio')!
    expect(desafio.adopters).toBe(1)      // u1 usou Desafio no dia 1
    expect(desafio.retAdopt).toBe(100)    // u1 retido
    expect(desafio.retNon).toBe(0)        // u2 não adotou e não reteve
    expect(desafio.lift).toBe(100)
    expect(rows[0].lift).toBeGreaterThanOrEqual(rows[rows.length - 1].lift) // ordenado desc
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx vitest run src/lib/admin/retention.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar a lib**

```typescript
export type Feature = 'simulador' | 'desafio' | 'simulados' | 'mapas' | 'social'
export const FEATURES: { key: Feature; label: string }[] = [
  { key: 'simulador', label: 'Simulador' },
  { key: 'desafio', label: 'Desafio' },
  { key: 'simulados', label: 'Simulados' },
  { key: 'mapas', label: 'Mapas' },
  { key: 'social', label: 'Comunidade' },
]
export type ActivityEvent = { feature: Feature; ts: number }
export type UserActivity = { id: string; signup: number; events: ActivityEvent[] }

const DAY = 86_400_000

export function isMature(u: UserActivity, now: number, days = 7): boolean {
  return now - u.signup >= days * DAY
}
export function isRetainedD7(u: UserActivity, now: number): boolean {
  const cutoff = u.signup + 7 * DAY
  return u.events.some((e) => e.ts >= cutoff)
}
function adoptedEarly(u: UserActivity, feature: Feature): boolean {
  const window = u.signup + 7 * DAY
  return u.events.some((e) => e.feature === feature && e.ts <= window)
}

export function retentionD7(users: UserActivity[], now: number) {
  const mature = users.filter((u) => isMature(u, now))
  const retained = mature.filter((u) => isRetainedD7(u, now))
  return { eligible: mature.length, retained: retained.length, pct: mature.length ? Math.round((retained.length / mature.length) * 100) : 0 }
}

export function retentionCurve(users: UserActivity[], now: number, marks: number[] = [1, 7, 14, 30]) {
  return marks.map((n) => {
    const eligible = users.filter((u) => now - u.signup >= n * DAY)
    const retained = eligible.filter((u) => u.events.some((e) => e.ts >= u.signup + n * DAY))
    return { dayMark: n, eligible: eligible.length, retained: retained.length, pct: eligible.length ? Math.round((retained.length / eligible.length) * 100) : 0 }
  })
}

export function featureLift(users: UserActivity[], now: number) {
  const mature = users.filter((u) => isMature(u, now))
  return FEATURES.map(({ key, label }) => {
    const adopters = mature.filter((u) => adoptedEarly(u, key))
    const nonAdopters = mature.filter((u) => !adoptedEarly(u, key))
    const rate = (arr: UserActivity[]) => (arr.length ? Math.round((arr.filter((u) => isRetainedD7(u, now)).length / arr.length) * 100) : 0)
    const retAdopt = rate(adopters)
    const retNon = rate(nonAdopters)
    return { feature: key, label, adopters: adopters.length, nonAdopters: nonAdopters.length, retAdopt, retNon, lift: retAdopt - retNon }
  }).sort((a, b) => b.lift - a.lift)
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx vitest run src/lib/admin/retention.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/retention.ts src/lib/admin/retention.test.ts
git commit -m "feat(retencao): lib pura (D7, curva, lift por recurso) + testes"
```

---

### Task 3: Seção "Retenção" no painel agregado

**Files:**
- Create: `src/components/admin/RetentionSection.tsx`
- Modify: `src/app/(dashboard)/admin/page.tsx`

**Interfaces:**
- Consumes: `retentionD7`, `retentionCurve`, `featureLift`, `FEATURES`, `UserActivity` (Task 2).
- Produces: `RetentionSection({ d7, curve, lift, maturedN })` — componente de apresentação.

- [ ] **Step 1: Componente de apresentação**

```tsx
import type { Feature } from '@/lib/admin/retention'

type Curve = { dayMark: number; eligible: number; retained: number; pct: number }[]
type Lift = { feature: Feature; label: string; adopters: number; nonAdopters: number; retAdopt: number; retNon: number; lift: number }[]

export function RetentionSection({ d7, curve, lift, maturedN }: {
  d7: { eligible: number; retained: number; pct: number }; curve: Curve; lift: Lift; maturedN: number
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted">Base: {maturedN} alunos maduros (cadastrados há 7+ dias). <b className="text-ink">N pequeno → direcional, não estatístico.</b></p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Retenção D7</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{d7.pct}%</p>
          <p className="mt-0.5 text-xs text-muted">{d7.retained} de {d7.eligible} voltaram após 7 dias</p>
          <div className="mt-4 space-y-2">
            {curve.map((p) => (
              <div key={p.dayMark} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs text-muted">D{p.dayMark}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="w-16 text-right text-xs tabular-nums text-ink">{p.pct}% <span className="text-muted">({p.eligible})</span></span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Qual recurso mais retém (lift)</p>
          <p className="mb-2 mt-1 text-[11px] text-muted">lift = retenção de quem adotou − de quem não. Correlação, não causa.</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Recurso</th>
                <th className="py-1 text-right font-medium">Adotou</th>
                <th className="py-1 text-right font-medium">Ret. sim/não</th>
                <th className="py-1 text-right font-medium">Lift</th>
              </tr>
            </thead>
            <tbody>
              {lift.map((r) => (
                <tr key={r.feature} className="border-t border-border/60">
                  <td className="py-1.5 text-ink">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.adopters}{r.adopters < 5 ? '*' : ''}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.retAdopt}% / {r.retNon}%</td>
                  <td className={`py-1.5 text-right font-semibold tabular-nums ${r.lift > 0 ? 'text-success' : r.lift < 0 ? 'text-danger' : 'text-muted'}`}>{r.lift > 0 ? '+' : ''}{r.lift}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-muted">* base pequena (&lt; 5) — pouco confiável.</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Montar eventos e renderizar no `admin/page.tsx`**

Adicionar ao `Promise.all` uma busca de mapas (as demais fontes já são carregadas — `consultations`, `patients`, `reactions`, `feedPosts`, `quizAns`, e `examAtt` agora com `created_at`):

```typescript
    admin.from('disease_maps').select('user_id, created_at'),
```
Destructurar como `mapsRes` no fim do array.

Depois de carregar tudo, montar `UserActivity[]` e calcular (inserir perto do cálculo de `lastActivityByUser`, importando as funções no topo):

```typescript
import { retentionD7, retentionCurve, featureLift, type Feature, type UserActivity } from '@/lib/admin/retention'
import { RetentionSection } from '@/components/admin/RetentionSection'
```
```typescript
  const diseaseMaps = (mapsRes.data ?? []) as Array<{ user_id: string; created_at: string | null }>
  const nowMs = now.getTime()
  const eventsByUser = new Map<string, { feature: Feature; ts: number }[]>()
  const pushEv = (uid: string | null | undefined, feature: Feature, ts: string | null | undefined) => {
    if (!uid || !ts) return
    const t = Date.parse(ts); if (Number.isNaN(t)) return
    const arr = eventsByUser.get(uid); if (arr) arr.push({ feature, ts: t }); else eventsByUser.set(uid, [{ feature, ts: t }])
  }
  for (const c of consultations) pushEv(c.user_id, 'simulador', c.created_at)
  for (const p of patients) pushEv(p.user_id, 'simulador', p.created_at)
  for (const q of quizAns) pushEv(q.user_id, 'desafio', q.created_at)
  for (const e of examAtt as Array<{ user_id: string; created_at?: string | null }>) pushEv(e.user_id, 'simulados', e.created_at)
  for (const m of diseaseMaps) pushEv(m.user_id, 'mapas', m.created_at)
  for (const p of feedPosts) pushEv(p.author_id, 'social', p.created_at)
  for (const r of reactions) pushEv(r.user_id, 'social', r.created_at)
  const activity: UserActivity[] = authUsers.map((u) => ({ id: u.id, signup: u.created_at ? Date.parse(u.created_at) : nowMs, events: eventsByUser.get(u.id) ?? [] }))
  const d7 = retentionD7(activity, nowMs)
  const curve = retentionCurve(activity, nowMs)
  const lift = featureLift(activity, nowMs)
```
Adicionar `created_at` ao select de `exam_attempts` no `Promise.all` (`select('user_id, exam, area, score, total, created_at')`).

Renderizar a seção logo após `<SectionTitle>Visão geral</SectionTitle>` e os cards (antes de "Engajamento"):

```tsx
      <SectionTitle hint="o que traz o aluno de volta">Retenção</SectionTitle>
      <RetentionSection d7={d7} curve={curve} lift={lift} maturedN={d7.eligible} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/RetentionSection.tsx "src/app/(dashboard)/admin/page.tsx"
git commit -m "feat(retencao): seção Retenção no painel (D7 + curva + lift por recurso)"
```

---

### Task 4: Ficha individual enriquecida (`/admin/[id]`)

**Files:**
- Modify: `src/app/(dashboard)/admin/[id]/page.tsx`

**Interfaces:**
- Consumes: `isRetainedD7`, `isMature`, `type UserActivity`, `type Feature` (Task 2).

- [ ] **Step 1: Buscar as fontes que faltam para o aluno**

No `Promise.all` do `admin/[id]/page.tsx`, acrescentar (o arquivo já busca `patients`, `consultations`, `exam_requests`, `prescriptions`):

```typescript
    admin.from('quiz_answers').select('is_correct, created_at').eq('user_id', id),
    admin.from('exam_attempts').select('score, total, created_at').eq('user_id', id),
    admin.from('disease_maps').select('id, disease, created_at').eq('user_id', id),
    admin.from('posts').select('created_at').eq('author_id', id),
    admin.from('post_reactions').select('created_at').eq('user_id', id),
```
Destructurar como `quizRes, simRes, mapsRes, postsRes, reactsRes`.

- [ ] **Step 2: Calcular métricas por recurso + status de retenção**

```typescript
import { isMature, isRetainedD7, type Feature, type UserActivity } from '@/lib/admin/retention'
```
```typescript
  const quiz = (quizRes.data ?? []) as Array<{ is_correct: boolean; created_at: string | null }>
  const sims = (simRes.data ?? []) as Array<{ score: number; total: number; created_at: string | null }>
  const maps = (mapsRes.data ?? []) as Array<{ id: string; disease: string; created_at: string | null }>
  const myPosts = (postsRes.data ?? []) as Array<{ created_at: string | null }>
  const myReacts = (reactsRes.data ?? []) as Array<{ created_at: string | null }>

  const quizAcc = quiz.length ? pct(quiz.filter((q) => q.is_correct).length, quiz.length) : null
  const simAvg = sims.length ? Math.round(sims.reduce((s, e) => s + (e.total ? e.score / e.total : 0), 0) / sims.length * 100) : null
  const consFinished = consultations.filter((c) => c.status === 'finished').length

  // status de retenção (mesma régua da lib)
  const nowMs = Date.now()
  const ev: { feature: Feature; ts: number }[] = []
  const push = (f: Feature, ts: string | null | undefined) => { if (!ts) return; const t = Date.parse(ts); if (!Number.isNaN(t)) ev.push({ feature: f, ts: t }) }
  for (const c of consultations) push('simulador', c.created_at)
  for (const q of quiz) push('desafio', q.created_at)
  for (const s of sims) push('simulados', s.created_at)
  for (const m of maps) push('mapas', m.created_at)
  for (const p of myPosts) push('social', p.created_at)
  for (const r of myReacts) push('social', r.created_at)
  const uact: UserActivity = { id: au.id, signup: au.created_at ? Date.parse(au.created_at) : nowMs, events: ev }
  const retencaoStatus = !isMature(uact, nowMs) ? { label: 'Novo', tone: 'text-muted' }
    : isRetainedD7(uact, nowMs) ? { label: 'Retido', tone: 'text-success' }
    : { label: 'Em risco', tone: 'text-danger' }
  const timeline = [...ev].sort((a, b) => a.ts - b.ts)
```

- [ ] **Step 3: Renderizar os blocos por recurso + status + linha do tempo**

Adicionar o selo de status perto do cabeçalho do aluno:

```tsx
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${retencaoStatus.tone} border-current/40`}>{retencaoStatus.label}</span>
```

E uma grade de blocos por recurso (inserir numa seção da ficha):

```tsx
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Desafio</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{quiz.length}</p>
              <p className="text-xs text-muted">respostas{quizAcc != null ? ` · ${quizAcc}% de acerto` : ''}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Simulados</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{sims.length}</p>
              <p className="text-xs text-muted">{simAvg != null ? `${simAvg}% médio` : 'nenhum ainda'}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Mapas da Doença</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{maps.length}</p>
              <p className="truncate text-xs text-muted">{maps.length ? maps.map((m) => m.disease).slice(0, 3).join(', ') : 'nenhum ainda'}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Comunidade</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{myPosts.length + myReacts.length}</p>
              <p className="text-xs text-muted">{myPosts.length} posts · {myReacts.length} curtidas</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Simulador</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{consultations.length}</p>
              <p className="text-xs text-muted">{consFinished} finalizadas</p>
            </div>
          </div>
```

E uma linha do tempo simples (opcional, abaixo dos blocos):

```tsx
          {timeline.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Linha do tempo</p>
              <div className="flex flex-wrap gap-1.5">
                {timeline.slice(-20).map((e, i) => (
                  <span key={i} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                    {e.feature} · {new Date(e.ts).toLocaleDateString('pt-BR')}
                  </span>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/admin/[id]/page.tsx"
git commit -m "feat(ficha): desempenho por recurso + status de retenção + linha do tempo"
```

---

### Task 5: Build, deploy e verificação

- [ ] **Step 1: Suite**

Run: `npm test`
Expected: os novos testes de `retention` passam (ignorar as 7 falhas pré-existentes já conhecidas em `auth/redirect`, `challenge/prompts`, `cron/weekly-case`).

- [ ] **Step 2: Push + deploy**

```bash
git push origin main
curl -s -X POST "http://2.25.135.251:3000/api/deploy/bb8c580877a458b31ebb966072962eaa9d519d41c2a7796b" -w "\nHTTP %{http_code}\n"
```

- [ ] **Step 3: Confirmar build** por `/api/version` (builtAt novo).

- [ ] **Step 4: Verificação manual (admin logado)**

Abrir `/admin`: ver a seção **Retenção** (D7, curva D1/D7/D14/D30, tabela de lift ordenada por recurso, com avisos). Abrir `/admin/<id>` de um aluno: ver status de retenção, blocos por recurso e linha do tempo.

---

## Self-Review

**Spec coverage:**
- §4 D7 + maturidade → Task 2 (`isMature`, `isRetainedD7`, `retentionD7`). ✅
- §5 curva → Task 2 (`retentionCurve`) + Task 3 (render). ✅
- §6 lift por recurso → Task 2 (`featureLift`) + Task 3 (tabela). ✅
- §7 ficha individual → Task 4. ✅
- §8 seção agregada → Task 3. ✅
- §9 exam_attempts.created_at → Task 1 (+ select atualizado na Task 3). ✅
- §10 lib pura + consumo server → Task 2/3/4. ✅
- §11 avisos (N pequeno, correlação) → Task 3 (textos na UI). ✅

**Placeholder scan:** sem TBD/TODO; todo passo tem código/comando concretos.

**Type consistency:** `UserActivity`/`Feature` definidos na Task 2 e usados idênticos nas Tasks 3/4; `featureLift`/`retentionCurve`/`retentionD7` com as mesmas assinaturas entre definição (Task 2) e consumo (Task 3). `pushEv`/`push` montam eventos no formato `{feature, ts}` que a lib espera.
