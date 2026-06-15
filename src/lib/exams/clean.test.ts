import { describe, it, expect } from 'vitest'
import { cleanExamResult } from './clean'

describe('cleanExamResult', () => {
  it('remove linhas interpretativas (impressão/conclusão/sugere-se/compatível com)', () => {
    const raw = [
      'Hemoglobina: 9,2 g/dL (VR 12-16)',
      'Impressão: anemia microcítica',
      'Conclusão: investigar ferropenia',
      'Sugere-se reposição de ferro',
      'Compatível com anemia ferropriva',
    ].join('\n')
    const out = cleanExamResult(raw)
    expect(out).toContain('Hemoglobina: 9,2 g/dL')
    expect(out).not.toMatch(/impress[ãa]o/i)
    expect(out).not.toMatch(/conclus[ãa]o/i)
    expect(out).not.toMatch(/sugere-se/i)
    expect(out).not.toMatch(/compat[íi]vel com/i)
  })

  it('remove títulos/rótulos de laudo ("Laudo:", "Resultado do exame:")', () => {
    const raw = 'Laudo: Hemograma\nResultado do exame: completo\nLeucócitos: 7.500/mm3'
    const out = cleanExamResult(raw)
    expect(out).not.toMatch(/^laudo/im)
    expect(out).not.toMatch(/resultado do exame/i)
    expect(out).toContain('Leucócitos: 7.500/mm3')
  })

  it('remove markdown (negrito, headers, tabelas)', () => {
    const raw = '## Hemograma\n**Hemoglobina** | 13,5 | VR 12-16'
    const out = cleanExamResult(raw)
    expect(out).not.toContain('#')
    expect(out).not.toContain('*')
    expect(out).not.toContain('|')
    expect(out).toContain('Hemoglobina')
  })

  it('é idempotente', () => {
    const raw = 'Glicose: 92 mg/dL (VR 70-99)\nImpressão: normal'
    const once = cleanExamResult(raw)
    expect(cleanExamResult(once)).toBe(once)
  })

  it('preserva um laudo já limpo', () => {
    const clean = 'Sódio: 140 mEq/L (VR 135-145)\nPotássio: 4,2 mEq/L (VR 3,5-5,0)'
    expect(cleanExamResult(clean)).toBe(clean)
  })
})
