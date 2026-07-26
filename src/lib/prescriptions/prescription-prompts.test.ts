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

  it('proíbe revelar/nomear o diagnóstico verdadeiro no feedback', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'Furosemida', '40 mg VO 1x/dia', 'congestão')
    const lower = p.toLowerCase()
    expect(lower).toContain('não')
    expect(lower).toContain('feedback')
    // deve conter uma proibição explícita de nomear/revelar o diagnóstico
    // ([\s\S] em vez do flag /s para compatibilidade com o target do tsconfig)
    expect(/n[ãa]o[\s\S]*(nome|cit|revel)[\s\S]*(diagn[óo]stico)/.test(lower)).toBe(true)
  })

  it('trata medicamento como prescrição de fármaco', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'terlipressina', '2mg 4/4h', null, null, 'medicamento')
    expect(p).toMatch(/medicamento|fármaco/i)
  })

  it('trata procedimento sem falar em posologia/dose', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'ligadura elástica', 'sessão inicial', null, null, 'procedimento')
    expect(p).toMatch(/procedimento/i)
    expect(p).toContain('ligadura elástica')
  })

  it('mantém a proibição de revelar o diagnóstico (com kind)', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'terlipressina', '2mg', null, null, 'medicamento')
    expect(p).toMatch(/NÃO REVELE O DIAGNÓSTICO/i)
  })

  it('default sem kind = medicamento (compat)', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'losartana', '50mg/dia', null, null)
    expect(p).toMatch(/medicamento|fármaco/i)
  })
})
