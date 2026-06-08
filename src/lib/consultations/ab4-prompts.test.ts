import { describe, it, expect } from 'vitest'
import { buildAb4ScorePrompt } from './ab4-prompts'

const patientStub = {
  name: 'Maria', age: 60, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'falta de ar', clinical_status: 'dispneia',
  conditions: ['HAS'], difficulty: 'hard', true_diagnosis: 'Insuficiência cardíaca',
} as never

const baseArgs = {
  chatHistory: [
    { role: 'student', content: 'Há quanto tempo tem falta de ar?' },
    { role: 'patient', content: 'Há duas semanas, piora deitada.' },
  ] as never,
  examRequests: [
    { exam_name: 'Ecocardiograma', justification: 'avaliar função sistólica', result: 'FE 38%', status: 'approved' },
  ],
  physicalExamSummary: 'Estertores em bases, turgência jugular',
  clinicalReasoning: 'Quadro de IC; FE reduzida confirma disfunção sistólica',
}

describe('buildAb4ScorePrompt', () => {
  it('inclui os 4 eixos e a trava de independência do acerto', () => {
    const p = buildAb4ScorePrompt(patientStub, baseArgs.chatHistory, baseArgs.examRequests, baseArgs.physicalExamSummary, baseArgs.clinicalReasoning)
    expect(p).toContain('A1')
    expect(p).toContain('A2')
    expect(p).toContain('A3')
    expect(p).toContain('A4')
    expect(p.toLowerCase()).toContain('independente')
  })

  it('inclui a escala de calibração e a instrução da recomendação', () => {
    const p = buildAb4ScorePrompt(patientStub, baseArgs.chatHistory, baseArgs.examRequests, baseArgs.physicalExamSummary, baseArgs.clinicalReasoning)
    expect(p).toMatch(/0\s*[-–]\s*2/)
    expect(p.toLowerCase()).toContain('recommendation')
    expect(p.toLowerCase()).toMatch(/eixos? (mais )?fracos?|menor nota/)
  })

  it('injeta os artefatos: justificativa, RESULTADO do exame e pensamento clínico', () => {
    const p = buildAb4ScorePrompt(patientStub, baseArgs.chatHistory, baseArgs.examRequests, baseArgs.physicalExamSummary, baseArgs.clinicalReasoning)
    expect(p).toContain('Ecocardiograma')
    expect(p).toContain('avaliar função sistólica')
    expect(p).toContain('FE 38%')
    expect(p).toContain('disfunção sistólica')
  })

  it('explicita que A3 avalia justificar exame e interpretar o resultado', () => {
    const p = buildAb4ScorePrompt(patientStub, baseArgs.chatHistory, baseArgs.examRequests, baseArgs.physicalExamSummary, baseArgs.clinicalReasoning)
    expect(p.toLowerCase()).toMatch(/resultado/)
    expect(p.toLowerCase()).toMatch(/confirma|refuta|enfraquece/)
  })

  it('exige saída JSON', () => {
    const p = buildAb4ScorePrompt(patientStub, baseArgs.chatHistory, baseArgs.examRequests, baseArgs.physicalExamSummary, baseArgs.clinicalReasoning)
    expect(p.toUpperCase()).toContain('JSON')
  })
})
