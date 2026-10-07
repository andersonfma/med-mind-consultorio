import { describe, it, expect } from 'vitest'
import { relativeTime } from './time'

const now = new Date('2026-10-07T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H

describe('relativeTime', () => {
  it('menos de 45s = "agora"', () => { expect(relativeTime(ago(10 * S), now)).toBe('agora') })
  it('minutos', () => { expect(relativeTime(ago(30 * M), now)).toBe('há 30 min') })
  it('horas', () => { expect(relativeTime(ago(3 * H), now)).toBe('há 3 h') })
  it('dias', () => { expect(relativeTime(ago(2 * D), now)).toBe('há 2 d') })
  it('semanas', () => { expect(relativeTime(ago(14 * D), now)).toBe('há 2 sem') })
  it('acima de ~30d vira data curta', () => { expect(relativeTime(ago(40 * D), now)).toMatch(/\d{2}\/\d{2}\/\d{2}/) })
  it('entrada inválida/nula → vazio', () => {
    expect(relativeTime(null, now)).toBe('')
    expect(relativeTime('não-é-data', now)).toBe('')
  })
})
