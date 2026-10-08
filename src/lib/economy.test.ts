import { describe, it, expect } from 'vitest'
import { allowedStake, resolveBet, streakFactor, nextStreak, isDayOpen, dayFactor } from './economy'

describe('allowedStake', () => {
  it('0 (sem aposta) sempre', () => { expect(allowedStake(0, 999)).toBe(0) })
  it('10 sempre, mesmo com saldo 0 (faixa da casa)', () => { expect(allowedStake(10, 0)).toBe(10) })
  it('25/50 só com saldo suficiente; senão rebaixa', () => {
    expect(allowedStake(50, 100)).toBe(50)
    expect(allowedStake(50, 30)).toBe(25)
    expect(allowedStake(25, 10)).toBe(10)
    expect(allowedStake(50, 0)).toBe(10)
  })
})

describe('resolveBet', () => {
  it('sem aposta → delta 0', () => { expect(resolveBet(0, true, 100, 1, 1).delta).toBe(0) })
  it('acerto → +effStake × fatores', () => {
    expect(resolveBet(50, true, 100, 1, 1)).toEqual({ delta: 50, effStake: 50 })
    expect(resolveBet(50, true, 100, 2, 1).delta).toBe(100)
    expect(resolveBet(10, true, 100, 1, 1.5).delta).toBe(15)
  })
  it('erro → -effStake, saldo nunca negativo', () => {
    expect(resolveBet(50, false, 100, 1, 1).delta).toBe(-50)
    expect(resolveBet(10, false, 0, 1, 1).delta).toBe(0)
    expect(resolveBet(25, false, 10, 1, 1).delta).toBe(-10)
  })
})

describe('streakFactor', () => {
  it('1 no streak 1; cresce 0,1/dia; cap 2,0', () => {
    expect(streakFactor(1)).toBeCloseTo(1)
    expect(streakFactor(3)).toBeCloseTo(1.2)
    expect(streakFactor(20)).toBeCloseTo(2.0)
  })
})

describe('nextStreak', () => {
  it('primeiro dia → 1', () => { expect(nextStreak(null, '2026-10-08')).toBe(1) })
  it('dia consecutivo → +1', () => { expect(nextStreak('2026-10-07', '2026-10-08', 1)).toBe(2) })
  it('pulou → reseta 1', () => { expect(nextStreak('2026-10-05', '2026-10-08', 4)).toBe(1) })
  it('mesmo dia → mantém', () => { expect(nextStreak('2026-10-08', '2026-10-08', 1)).toBe(1) })
})

describe('isDayOpen / dayFactor', () => {
  it('abre se revealDate <= hoje', () => {
    expect(isDayOpen('2026-10-08', '2026-10-08')).toBe(true)
    expect(isDayOpen('2026-10-09', '2026-10-08')).toBe(false)
  })
  it('conclusao vale x2', () => { expect(dayFactor('conclusao')).toBe(2); expect(dayFactor('anamnese')).toBe(1) })
})
