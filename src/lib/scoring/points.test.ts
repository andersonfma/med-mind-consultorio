import { describe, it, expect } from 'vitest'
import { computePoints, ACHIEVED_BONUS } from './points'

describe('computePoints', () => {
  it('difícil + nota alta vale muito mais que fácil + nota baixa', () => {
    expect(computePoints('hard', 8)).toBeGreaterThan(computePoints('easy', 2))
  })

  it('aplica fator 0,5..1,0 sobre o peso', () => {
    // hard=35: nota 10 → 35×1,0=35 ; nota 0 → 35×0,5=17.5→18
    expect(computePoints('hard', 10)).toBe(35)
    expect(computePoints('hard', 0)).toBe(18)
    // medium=20: nota 8 → 20×0,9=18
    expect(computePoints('medium', 8)).toBe(18)
    // easy=10: nota 5 → 10×0,75=7.5→8
    expect(computePoints('easy', 5)).toBe(8)
  })

  it('sem AB4 (null) usa fator mínimo 0,5 — ainda premia a prática', () => {
    expect(computePoints('medium', null)).toBe(10) // 20×0,5
    expect(computePoints('hard', undefined)).toBe(18)
  })

  it('clampa nota fora de 0..10', () => {
    expect(computePoints('hard', 99)).toBe(35)
    expect(computePoints('hard', -5)).toBe(18)
  })

  it('bônus de alcançado é 15', () => {
    expect(ACHIEVED_BONUS).toBe(15)
  })
})
