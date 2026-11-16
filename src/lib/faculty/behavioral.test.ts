import { describe, it, expect } from 'vitest'
import { activeDays, recencyDays, currentStreak, isAtRisk, completionFunnel, monthlyTrend, studyWindow } from './behavioral'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 16, 12, 0, 0) // 2026-11-16 12:00 UTC

describe('activeDays', () => {
  it('conta dias distintos', () => {
    expect(activeDays([now, now - 1000, now - DAY, now - 2 * DAY])).toBe(3)
  })
})

describe('recencyDays', () => {
  it('dias desde a última atividade', () => {
    expect(recencyDays([now - 3 * DAY, now - 10 * DAY], now)).toBe(3)
  })
  it('null sem eventos', () => {
    expect(recencyDays([], now)).toBeNull()
  })
})

describe('currentStreak', () => {
  it('conta dias consecutivos terminando hoje', () => {
    expect(currentStreak([now, now - DAY, now - 2 * DAY], now)).toBe(3)
  })
  it('quebra no buraco', () => {
    expect(currentStreak([now, now - DAY, now - 3 * DAY], now)).toBe(2)
  })
  it('ontem ainda conta', () => {
    expect(currentStreak([now - DAY, now - 2 * DAY], now)).toBe(2)
  })
  it('zero se parou há 2+ dias', () => {
    expect(currentStreak([now - 3 * DAY], now)).toBe(0)
  })
})

describe('isAtRisk', () => {
  it('em risco sem eventos', () => {
    expect(isAtRisk([], now)).toBe(true)
  })
  it('em risco após o limite', () => {
    expect(isAtRisk([now - 20 * DAY], now, 14)).toBe(true)
    expect(isAtRisk([now - 5 * DAY], now, 14)).toBe(false)
  })
})

describe('completionFunnel', () => {
  it('taxa de conclusão', () => {
    expect(completionFunnel(10, 7)).toEqual({ started: 10, finished: 7, rate: 70 })
  })
  it('zero sem começos', () => {
    expect(completionFunnel(0, 0).rate).toBe(0)
  })
})

describe('studyWindow', () => {
  it('classifica bloco e dia da semana', () => {
    const manha = Date.UTC(2026, 10, 16, 9, 0, 0) // 09h
    const noite = Date.UTC(2026, 10, 17, 21, 0, 0) // 21h (dia seguinte)
    const w = studyWindow([manha, noite])
    expect(w.byBlock.manha).toBe(1)
    expect(w.byBlock.noite).toBe(1)
    expect(w.byWeekday[new Date(manha).getUTCDay()]).toBe(1)
    expect(w.byWeekday[new Date(noite).getUTCDay()]).toBe(1)
    expect(w.byWeekday.reduce((a, b) => a + b, 0)).toBe(2)
  })
})

describe('monthlyTrend', () => {
  it('média mensal ordenada', () => {
    const t = monthlyTrend([
      { ts: Date.UTC(2026, 8, 5), value: 6 },
      { ts: Date.UTC(2026, 8, 20), value: 8 },
      { ts: Date.UTC(2026, 9, 1), value: 7 },
    ])
    expect(t).toEqual([
      { periodKey: '2026-09', avg: 7, n: 2 },
      { periodKey: '2026-10', avg: 7, n: 1 },
    ])
  })
})
