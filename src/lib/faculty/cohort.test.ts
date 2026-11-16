import { describe, it, expect } from 'vitest'
import { groupByPeriodo, normPeriodo } from './cohort'

describe('normPeriodo', () => {
  it('trim e colapsa espaços; vazio => null', () => {
    expect(normPeriodo('  5º  período ')).toBe('5º período')
    expect(normPeriodo('')).toBeNull()
    expect(normPeriodo(null)).toBeNull()
  })
})

describe('groupByPeriodo', () => {
  it('agrupa e ordena numericamente (10º depois de 2º)', () => {
    const g = groupByPeriodo([
      { id: 'a', periodo: '10º' },
      { id: 'b', periodo: '2º' },
      { id: 'c', periodo: '2º' },
    ])
    expect(g.map((t) => t.periodo)).toEqual(['2º', '10º'])
    expect(g[0].students).toHaveLength(2)
  })
  it('"Sem período" vai para o fim', () => {
    const g = groupByPeriodo([
      { id: 'a', periodo: null },
      { id: 'b', periodo: '1º' },
    ])
    expect(g[g.length - 1].periodo).toBe('Sem período')
    expect(g[g.length - 1].isUnknown).toBe(true)
  })
})
