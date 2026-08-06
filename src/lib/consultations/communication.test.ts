import { describe, it, expect } from 'vitest'
import { parseCommunicationResponse, emptyCommunicationResult, EMPTY_COMMUNICATION_RECOMMENDATION } from './communication'

describe('parseCommunicationResponse', () => {
  it('parseia c1/c2/c3 e calcula o overall (média, 1 casa)', () => {
    const r = parseCommunicationResponse('{"c1":8,"c2":6,"c3":7,"recommendation":"bom diálogo"}')
    expect(r).toEqual({ c1: 8, c2: 6, c3: 7, overall: 7, recommendation: 'bom diálogo' })
  })

  it('faz clamp de notas fora de 0–10 e arredonda', () => {
    const r = parseCommunicationResponse('{"c1":12,"c2":-3,"c3":5.4,"recommendation":"x"}')
    expect(r).toEqual({ c1: 10, c2: 0, c3: 5, overall: 5, recommendation: 'x' })
  })

  it('retorna null se faltar nota, recommendation vazia, ou JSON inválido', () => {
    expect(parseCommunicationResponse('{"c1":8,"c2":6,"recommendation":"x"}')).toBeNull()
    expect(parseCommunicationResponse('{"c1":8,"c2":6,"c3":7,"recommendation":"  "}')).toBeNull()
    expect(parseCommunicationResponse('não é json')).toBeNull()
  })
})

describe('emptyCommunicationResult', () => {
  it('zera as notas e usa a recomendação fixa', () => {
    expect(emptyCommunicationResult()).toEqual({
      c1: 0, c2: 0, c3: 0, overall: 0, recommendation: EMPTY_COMMUNICATION_RECOMMENDATION,
    })
  })
})
