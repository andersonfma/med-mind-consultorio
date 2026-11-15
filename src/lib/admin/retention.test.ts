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
    expect(r.eligible).toBe(2)
    expect(r.retained).toBe(1)
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
    expect(desafio.adopters).toBe(1)
    expect(desafio.retAdopt).toBe(100)
    expect(desafio.retNon).toBe(0)
    expect(desafio.lift).toBe(100)
    expect(rows[0].lift).toBeGreaterThanOrEqual(rows[rows.length - 1].lift)
  })
})
