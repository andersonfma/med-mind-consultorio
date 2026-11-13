import { describe, it, expect } from 'vitest'
import { parseDiseaseMap } from './schema'

const valid = JSON.stringify({
  disease: 'Cirrose hepática',
  area: 'Hepatologia',
  core: [{ mechanism: 'Hipertensão portal', detail: 'fibrose ↑ a resistência intra-hepática' }],
  clinica: [{ label: 'Ascite', chain: ['hipertensão portal', 'vasodilatação esplâncnica', '↓ volemia efetiva', 'SRAA + ADH', 'retenção de Na⁺ e água'] }],
  diagnostico: [{ label: 'Plaquetopenia', chain: ['esplenomegalia', 'hiperesplenismo'] }],
  tratamento: [{ label: 'Espironolactona', chain: ['antagoniza aldosterona', '↓ retenção de Na⁺'] }],
  summary: 'A hipertensão portal ativa o SRAA e retém líquido, gerando ascite.',
})

describe('parseDiseaseMap', () => {
  it('aceita um objeto completo com cascatas (chain)', () => {
    const m = parseDiseaseMap(valid)
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('outOfScope')
    if (m && !('outOfScope' in m)) {
      expect(m.disease).toBe('Cirrose hepática')
      expect(m.clinica[0].chain.length).toBeGreaterThanOrEqual(2)
      expect(m.clinica[0].chain).toContain('SRAA + ADH')
    }
  })

  it('rejeita item com chain vazia (a cascata é a correlação)', () => {
    const o = JSON.parse(valid); o.clinica = [{ label: 'Ascite', chain: [] }]
    expect(parseDiseaseMap(JSON.stringify(o))).toBeNull()
  })

  it('rejeita item sem chain', () => {
    const o = JSON.parse(valid); o.clinica = [{ label: 'Ascite' }]
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
