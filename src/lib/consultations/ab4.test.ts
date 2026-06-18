import { describe, it, expect } from 'vitest'
import { parseAb4Response, emptyReasoningResult } from './ab4'

describe('emptyReasoningResult', () => {
  it('zera os 4 eixos e o overall, com recomendação explicativa (etapa 2 padrão)', () => {
    const r = emptyReasoningResult()
    expect(r.a1).toBe(0)
    expect(r.a2).toBe(0)
    expect(r.a3).toBe(0)
    expect(r.a4).toBe(0)
    expect(r.overall).toBe(0)
    expect(r.stage).toBe(2)
    expect(r.recommendation.toLowerCase()).toContain('pensamento clínico')
  })

  it('na etapa 1, A3/A4 ficam null (pendentes)', () => {
    const r = emptyReasoningResult(1)
    expect(r.a1).toBe(0)
    expect(r.a2).toBe(0)
    expect(r.a3).toBeNull()
    expect(r.a4).toBeNull()
    expect(r.stage).toBe(1)
  })
})

describe('parseAb4Response — etapa 1 (primeira consulta)', () => {
  it('exige só a1/a2, deixa a3/a4 null e calcula overall pelos avaliados', () => {
    const r = parseAb4Response(JSON.stringify({ a1: 6, a2: 8, recommendation: 'amplie hipóteses' }), 1)
    expect(r).not.toBeNull()
    expect(r!.a1).toBe(6)
    expect(r!.a2).toBe(8)
    expect(r!.a3).toBeNull()
    expect(r!.a4).toBeNull()
    expect(r!.overall).toBe(7) // (6+8)/2
    expect(r!.stage).toBe(1)
  })

  it('ignora a3/a4 mesmo se o juiz mandar (etapa 1 não os avalia)', () => {
    const r = parseAb4Response(JSON.stringify({ a1: 5, a2: 5, a3: 9, a4: 9, recommendation: 'x' }), 1)
    expect(r!.a3).toBeNull()
    expect(r!.a4).toBeNull()
    expect(r!.overall).toBe(5)
  })

  it('retorna null se faltar a1 ou a2 na etapa 1', () => {
    expect(parseAb4Response(JSON.stringify({ a1: 6, recommendation: 'x' }), 1)).toBeNull()
  })
})

describe('parseAb4Response', () => {
  it('parseia notas válidas e calcula a média geral', () => {
    const r = parseAb4Response(JSON.stringify({ a1: 7, a2: 8, a3: 5, a4: 8, recommendation: 'foco no A3' }))
    expect(r).not.toBeNull()
    expect(r!.a1).toBe(7)
    expect(r!.a3).toBe(5)
    expect(r!.overall).toBe(7) // (7+8+5+8)/4 = 7.0
    expect(r!.recommendation).toBe('foco no A3')
  })

  it('faz clamp para [0,10] e arredonda floats', () => {
    const r = parseAb4Response(JSON.stringify({ a1: 12, a2: -3, a3: 7.6, a4: 4.4, recommendation: 'x' }))
    expect(r!.a1).toBe(10)
    expect(r!.a2).toBe(0)
    expect(r!.a3).toBe(8)
    expect(r!.a4).toBe(4)
  })

  it('calcula overall com 1 casa decimal', () => {
    const r = parseAb4Response(JSON.stringify({ a1: 7, a2: 8, a3: 8, a4: 8, recommendation: 'x' }))
    expect(r!.overall).toBe(7.8) // 31/4 = 7.75 -> 7.8
  })

  it('retorna null para JSON inválido', () => {
    expect(parseAb4Response('not json')).toBeNull()
  })

  it('retorna null se faltar um eixo', () => {
    expect(parseAb4Response(JSON.stringify({ a1: 7, a2: 8, a3: 5, recommendation: 'x' }))).toBeNull()
  })

  it('retorna null se um eixo não for número', () => {
    expect(parseAb4Response(JSON.stringify({ a1: 'sete', a2: 8, a3: 5, a4: 8, recommendation: 'x' }))).toBeNull()
  })

  it('retorna null se a recomendação estiver vazia', () => {
    expect(parseAb4Response(JSON.stringify({ a1: 7, a2: 8, a3: 5, a4: 8, recommendation: '   ' }))).toBeNull()
  })
})
