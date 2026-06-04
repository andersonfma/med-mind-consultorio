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
