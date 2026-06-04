import { describe, it, expect } from 'vitest'
import { parseAnamnesisResponse } from './parse'

describe('parseAnamnesisResponse', () => {
  it('retorna os 5 campos quando todos presentes', () => {
    const input = JSON.stringify({
      hda: 'Dor há 2 dias',
      hpp: 'Hipertensão',
      ad: 'Sem alergia',
      social: 'Não fumante',
      familiar: 'Pai com IAM',
    })
    const result = parseAnamnesisResponse(input)
    expect(result.hda).toBe('Dor há 2 dias')
    expect(result.hpp).toBe('Hipertensão')
    expect(result.ad).toBe('Sem alergia')
    expect(result.social).toBe('Não fumante')
    expect(result.familiar).toBe('Pai com IAM')
  })

  it('retorna string vazia para campos ausentes', () => {
    const input = JSON.stringify({ hda: 'Dor no peito' })
    const result = parseAnamnesisResponse(input)
    expect(result.hda).toBe('Dor no peito')
    expect(result.hpp).toBe('')
    expect(result.ad).toBe('')
    expect(result.social).toBe('')
    expect(result.familiar).toBe('')
  })

  it('retorna todos vazios para JSON inválido', () => {
    const result = parseAnamnesisResponse('not-json')
    expect(result.hda).toBe('')
    expect(result.hpp).toBe('')
    expect(result.ad).toBe('')
    expect(result.social).toBe('')
    expect(result.familiar).toBe('')
  })

  it('retorna string vazia para campos que não são string', () => {
    const input = JSON.stringify({ hda: 123, hpp: null })
    const result = parseAnamnesisResponse(input)
    expect(result.hda).toBe('')
    expect(result.hpp).toBe('')
  })
})
