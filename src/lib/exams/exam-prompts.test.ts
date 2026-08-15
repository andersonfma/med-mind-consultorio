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

  it('mantém a barra baixa para exames de 1ª/2ª linha (aprova com qualquer nexo)', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'Ecocardiograma', 'avaliar sopro e turgência jugular', '', ''
    )
    const lower = prompt.toLowerCase()
    // via permissiva de 1ª linha preservada (conserto do ECO-por-sopro não regride)
    expect(lower).toContain('1ª linha')
    expect(lower).toContain('qualquer nexo')
  })

  it('para exames de alta complexidade, o critério é MIRAR um achado concreto (não o custo)', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'PET-CT', 'investigar possível Sjögren', '', ''
    )
    const lower = prompt.toLowerCase()
    expect(lower).toContain('alta complexidade')
    expect(lower).toContain('indicação específica')
    expect(lower).toContain('pet')
    // discriminador: achado concreto/alvo vs exploratório/pescaria
    expect(lower).toContain('achado concreto')
    expect(lower).toContain('explorat')
  })

  it('aprova exame invasivo que amostra diretamente o achado (ex: biópsia de úlcera/lesão)', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'Biópsia de úlcera oral', 'úlcera oral em suspeita de Behçet', '', 'úlcera oral extensa'
    )
    const lower = prompt.toLowerCase()
    // exemplo positivo ancorado: biópsia de lesão visível quando a lesão é o achado
    expect(lower).toContain('biópsia')
    expect(lower).toContain('úlcera')
    // não exigir 1ª linha antes quando há achado-alvo claro
    expect(lower).toContain('não exija que exames de 1ª linha venham antes')
  })

  it('reprova quando não há nenhum nexo clínico', () => {
    const prompt = buildExamValidationPrompt(
      mockPatient as Patient, 'Ecocardiograma', 'só para conferir', '', ''
    )
    const lower = prompt.toLowerCase()
    expect(lower).toContain('nenhum nexo')
    expect(prompt).toContain('"approved": false')
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

describe('buildExamValidationPrompt — retorno/monitoramento', () => {
  it('injeta memória do caso e regra de monitoramento em retorno', () => {
    const p = buildExamValidationPrompt(
      mockPatient as Patient, 'Função renal', 'controle do diurético', '', '', 'SUMMARY_XYZ', true
    )
    expect(p).toContain('SUMMARY_XYZ')
    expect(p.toUpperCase()).toContain('RETORNO')
    expect(p.toLowerCase()).toContain('monitoramento')
  })

  it('não injeta regra de monitoramento quando não é retorno', () => {
    const p = buildExamValidationPrompt(
      mockPatient as Patient, 'Hemograma', 'investigar anemia', '', '', null, false
    )
    expect(p).not.toContain('SUMMARY_XYZ')
    expect(p.toLowerCase()).not.toContain('monitoramento/controle/seguimento')
  })
})
