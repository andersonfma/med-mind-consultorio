import { describe, it, expect } from 'vitest'
import { parseDiseaseMap } from './schema'

const valid = JSON.stringify({
  disease: 'Insuficiência cardíaca',
  area: 'Cardiologia',
  core: [{ mechanism: 'Falência de bomba do VE', detail: 'queda do débito e congestão retrógrada' }],
  clinica: [{ label: 'Turgência jugular e B3', because: 'congestão venosa sistêmica pela falência do VE' }],
  diagnostico: [{ label: 'BNP elevado; eco com FE reduzida', because: 'estiramento miocárdico e disfunção sistólica' }],
  tratamento: [{ label: 'Diurético de alça', because: 'reduz a congestão gerada pelo mecanismo' }],
  summary: 'A falha do VE gera congestão, que explica os achados e a resposta ao diurético.',
})

describe('parseDiseaseMap', () => {
  it('aceita um objeto completo e bem formado', () => {
    const m = parseDiseaseMap(valid)
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('outOfScope')
    if (m && !('outOfScope' in m)) {
      expect(m.disease).toBe('Insuficiência cardíaca')
      expect(m.core.length).toBeGreaterThanOrEqual(1)
      expect(m.clinica[0].because).toBeTruthy()
    }
  })

  it('rejeita item sem "because" (correlação não pode faltar)', () => {
    const o = JSON.parse(valid); o.clinica = [{ label: 'Dispneia', because: '' }]
    expect(parseDiseaseMap(JSON.stringify(o))).toBeNull()
  })

  it('rejeita quando falta uma seção obrigatória', () => {
    const o = JSON.parse(valid); delete o.tratamento
    expect(parseDiseaseMap(JSON.stringify(o))).toBeNull()
  })

  it('sinaliza fora de escopo', () => {
    expect(parseDiseaseMap(JSON.stringify({ error: 'out_of_scope' }))).toEqual({ outOfScope: true })
  })

  it('retorna null para JSON inválido', () => {
    expect(parseDiseaseMap('not json')).toBeNull()
  })
})
