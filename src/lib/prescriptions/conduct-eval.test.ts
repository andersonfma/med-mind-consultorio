import { describe, it, expect } from 'vitest'
import { buildConductEvalPrompt, parseConductAdequacy, type ConductItem } from './conduct-eval'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Celina', age: 60, specialty: 'Clínica Médica',
  chief_complaint: 'vômito com sangue', conditions: ['cirrose'],
  true_diagnosis: 'Hemorragia digestiva alta por varizes esofágicas',
} as unknown as Patient

const conduct: ConductItem[] = [
  { drug_name: 'terlipressina', posology: '2mg 4/4h', kind: 'medicamento' },
  { drug_name: 'ligadura elástica', posology: 'sessão inicial', kind: 'procedimento' },
]

describe('buildConductEvalPrompt', () => {
  it('lista o CONJUNTO da conduta com o tipo de cada item', () => {
    const p = buildConductEvalPrompt(patient, conduct)
    expect(p).toContain('terlipressina')
    expect(p).toContain('ligadura elástica')
    expect(p).toContain('procedimento')
  })

  it('avalia o conjunto (não item a item) e pede JSON com adequacy global', () => {
    const p = buildConductEvalPrompt(patient, conduct)
    expect(p).toMatch(/conjunto/i)
    expect(p).toContain('"adequacy"')
  })

  it('proíbe revelar o diagnóstico verdadeiro no texto', () => {
    const p = buildConductEvalPrompt(patient, conduct)
    expect(p).toMatch(/NÃO REVELE O DIAGNÓSTICO/i)
  })
})

describe('parseConductAdequacy', () => {
  it('extrai adequacy válida', () => {
    expect(parseConductAdequacy('{"adequacy":"adequada"}')).toBe('adequada')
    expect(parseConductAdequacy('{"adequacy":"parcial"}')).toBe('parcial')
    expect(parseConductAdequacy('{"adequacy":"inadequada"}')).toBe('inadequada')
  })

  it('retorna null para valor inesperado ou JSON inválido', () => {
    expect(parseConductAdequacy('{"adequacy":"ótima"}')).toBeNull()
    expect(parseConductAdequacy('não é json')).toBeNull()
    expect(parseConductAdequacy('{}')).toBeNull()
  })
})
