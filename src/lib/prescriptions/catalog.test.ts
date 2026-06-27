import { describe, it, expect } from 'vitest'
import { PRESCRIPTION_CATALOG, searchCatalog } from './catalog'
import { SPECIALTIES } from '@/lib/patients/specialties'

describe('PRESCRIPTION_CATALOG', () => {
  it('tem entradas para TODA especialidade', () => {
    for (const sp of SPECIALTIES) {
      expect(PRESCRIPTION_CATALOG[sp]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('toda entrada tem name, posology e indication não vazios', () => {
    for (const sp of SPECIALTIES) {
      for (const drug of PRESCRIPTION_CATALOG[sp]) {
        expect(drug.name.trim()).not.toBe('')
        expect(drug.posology.trim()).not.toBe('')
        expect(drug.indication.trim()).not.toBe('')
      }
    }
  })
})

describe('searchCatalog', () => {
  it('filtra por substring case-insensitive dentro da especialidade', () => {
    const res = searchCatalog('Cardiologia', 'losart')
    expect(res.some(d => d.name.toLowerCase().includes('losart'))).toBe(true)
  })

  it('retorna [] para query curta (< 2 chars)', () => {
    expect(searchCatalog('Cardiologia', 'l')).toEqual([])
  })

  it('não vaza medicamentos de outra especialidade', () => {
    const res = searchCatalog('Cardiologia', 'a')
    const cardioNames = PRESCRIPTION_CATALOG['Cardiologia'].map(d => d.name)
    for (const d of res) expect(cardioNames).toContain(d.name)
  })
})
