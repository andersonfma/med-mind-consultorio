import { describe, it, expect } from 'vitest'
import { formationIndex, bandFor, benchmarkPercentile, meanIndex, FORMATION_BANDS } from './formation'

describe('formationIndex', () => {
  it('média ponderada com todos os componentes', () => {
    // raciocinio 80*.3 + simulados 60*.3 + conduta 100*.15 + diagnostico 40*.15 + comunicacao 50*.1
    // = 24 + 18 + 15 + 6 + 5 = 68
    expect(formationIndex({ raciocinio: 80, simulados: 60, conduta: 100, diagnostico: 40, comunicacao: 50 })).toBe(68)
  })
  it('renormaliza pesos quando faltam componentes', () => {
    // só raciocinio 80 e simulados 60, pesos .3/.3 => (80+60)/2 = 70
    expect(formationIndex({ raciocinio: 80, simulados: 60 })).toBe(70)
  })
  it('null quando não há nenhum componente', () => {
    expect(formationIndex({})).toBeNull()
    expect(formationIndex({ raciocinio: null, simulados: null })).toBeNull()
  })
  it('clampa valores fora de 0–100', () => {
    expect(formationIndex({ raciocinio: 120 })).toBe(100)
    expect(formationIndex({ raciocinio: -5 })).toBe(0)
  })
})

describe('bandFor', () => {
  it('mapeia score para a faixa certa', () => {
    expect(bandFor(10)?.key).toBe('insuficiente')
    expect(bandFor(45)?.key).toBe('regular')
    expect(bandFor(70)?.key).toBe('bom')
    expect(bandFor(95)?.key).toBe('excelente')
    expect(bandFor(80)?.key).toBe('excelente')
  })
  it('null para score null', () => {
    expect(bandFor(null)).toBeNull()
  })
  it('todas as faixas têm tom definido', () => {
    expect(FORMATION_BANDS.every((b) => b.tone)).toBe(true)
  })
})

describe('benchmarkPercentile', () => {
  it('percentil = % da população abaixo do score', () => {
    expect(benchmarkPercentile(70, [40, 50, 60, 80, 90])).toBe(60) // 3 de 5 abaixo
  })
  it('null com população vazia ou score null', () => {
    expect(benchmarkPercentile(70, [])).toBeNull()
    expect(benchmarkPercentile(null, [1, 2])).toBeNull()
  })
})

describe('meanIndex', () => {
  it('ignora nulls', () => {
    expect(meanIndex([60, null, 80])).toBe(70)
  })
  it('null quando tudo é null', () => {
    expect(meanIndex([null, null])).toBeNull()
  })
})
