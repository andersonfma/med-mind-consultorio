import { describe, it, expect } from 'vitest'
import { buildExamValidationPrompt, buildExamResultPrompt } from './exam-prompts'
import type { Patient } from '@/types/domain'

const mockPatient: Partial<Patient> = {
  name: 'João Silva', age: 45, gender: 'M',
  specialty: 'Cardiologia', chief_complaint: 'Dor no peito',
  conditions: ['HAS'], difficulty: 'medium',
}

describe('buildExamValidationPrompt', () => {
  it('inclui nome do exame e justificativa', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'Troponina I', 'Suspeita de IAM', '', ''
    )
    expect(prompt).toContain('Troponina I')
    expect(prompt).toContain('Suspeita de IAM')
  })

  it('inclui dados do paciente', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'ECG', 'Suspeita de IAM', '', ''
    )
    expect(prompt).toContain('João Silva')
    expect(prompt).toContain('Cardiologia')
  })

  it('solicita JSON com approved e feedback', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'ECG', 'Dor torácica', '', ''
    )
    expect(prompt).toContain('"approved"')
    expect(prompt).toContain('"feedback"')
    expect(prompt).toContain('JSON')
  })

  it('inclui pensamento clínico e exame físico quando fornecidos', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'ECG', 'Dor', 'Suspeito de SCA', 'FC 110 bpm'
    )
    expect(prompt).toContain('Suspeito de SCA')
    expect(prompt).toContain('FC 110 bpm')
  })
})

describe('buildExamResultPrompt', () => {
  it('inclui nome do exame e dados do paciente', () => {
    const prompt = buildExamResultPrompt(mockPatient as Patient, 'Troponina I')
    expect(prompt).toContain('Troponina I')
    expect(prompt).toContain('João Silva')
    expect(prompt).toContain('medium')
  })

  it('pede laudo sem JSON', () => {
    const prompt = buildExamResultPrompt(mockPatient as Patient, 'ECG')
    expect(prompt.toLowerCase()).toContain('laudo')
    expect(prompt).toContain('Sem JSON')
  })
})
