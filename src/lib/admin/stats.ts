import 'server-only'
import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

export type ConsultRow = {
  user_id: string
  status: string
  created_at: string
  finished_at: string | null
  ab4_score: unknown
  communication_score: unknown
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

export function mean(nums: (number | null | undefined)[]): number | null {
  const v = nums.filter((n): n is number => typeof n === 'number')
  if (!v.length) return null
  return v.reduce((s, n) => s + n, 0) / v.length
}

// Extrai as 4 dimensões do raciocínio (AB4) de um score JSONB, ignorando o
// sentinela de "vazio". a3/a4 podem ser null na 1ª consulta (stage 1).
export function ab4Of(score: unknown) {
  if (!score || typeof score !== 'object') return null
  const o = score as Record<string, unknown>
  if (o.recommendation === EMPTY_REASONING_RECOMMENDATION) return null
  return { a1: num(o.a1), a2: num(o.a2), a3: num(o.a3), a4: num(o.a4), overall: num(o.overall) }
}

export function commOf(score: unknown) {
  if (!score || typeof score !== 'object') return null
  const o = score as Record<string, unknown>
  if (o.recommendation === EMPTY_COMMUNICATION_RECOMMENDATION) return null
  return { c1: num(o.c1), c2: num(o.c2), c3: num(o.c3), overall: num(o.overall) }
}

// Médias por dimensão de um conjunto de consultas.
export function ab4Averages(consults: { ab4_score: unknown }[]) {
  const rows = consults.map((c) => ab4Of(c.ab4_score)).filter((x): x is NonNullable<typeof x> => !!x)
  return {
    n: rows.length,
    a1: mean(rows.map((r) => r.a1)),
    a2: mean(rows.map((r) => r.a2)),
    a3: mean(rows.map((r) => r.a3)),
    a4: mean(rows.map((r) => r.a4)),
    overall: mean(rows.map((r) => r.overall)),
  }
}

export function commAverages(consults: { communication_score: unknown }[]) {
  const rows = consults.map((c) => commOf(c.communication_score)).filter((x): x is NonNullable<typeof x> => !!x)
  return {
    n: rows.length,
    c1: mean(rows.map((r) => r.c1)),
    c2: mean(rows.map((r) => r.c2)),
    c3: mean(rows.map((r) => r.c3)),
    overall: mean(rows.map((r) => r.overall)),
  }
}
