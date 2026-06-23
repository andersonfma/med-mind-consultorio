import { describe, it, expect } from 'vitest'
import { buildPrescriptionEvalPrompt } from './prescription-prompts'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Maria', age: 60, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'falta de ar aos esforços', clinical_status: 'estável',
  conditions: ['HAS'], difficulty: 'medium', true_diagnosis: 'Insuficiência cardíaca com fração de ejeção reduzida',
} as unknown as Patient

describe('buildPrescriptionEvalPrompt', () => {
  it('inclui o diagnóstico verdadeiro, o medicamento e a posologia', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'Furosemida', '40 mg VO 1x/dia', 'congestão')
    expect(p).toContain('Insuficiência cardíaca com fração de ejeção reduzida')
    expect(p).toContain('Furosemida')
    expect(p).toContain('40 mg VO 1x/dia')
    expect(p).toContain('congestão')
  })

  it('pede JSON com adequacy nas três faixas', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'X', 'Y', null)
    expect(p).toContain('adequada')
    expect(p).toContain('parcial')
    expect(p).toContain('inadequada')
    expect(p.toLowerCase()).toContain('json')
  })
})
