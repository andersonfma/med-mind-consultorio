import { describe, it, expect } from 'vitest'
import { buildPatientSystemPrompt, buildAnamnesisPrompt, buildFinishPrompt, buildCaseSummaryPrompt } from './prompts'
import type { Patient } from '@/types/domain'

const mockPatient: Partial<Patient> = {
  name: 'João Silva',
  age: 45,
  gender: 'M',
  specialty: 'Cardiologia',
  chief_complaint: 'Dor no peito há 2 dias',
  clinical_status: 'Paciente estável',
  conditions: ['HAS', 'DM'],
  difficulty: 'medium',
}

describe('buildPatientSystemPrompt', () => {
  it('inclui nome, queixa, condições e dificuldade do paciente', () => {
    const prompt = buildPatientSystemPrompt(mockPatient as Patient)
    expect(prompt).toContain('João Silva')
    expect(prompt).toContain('Dor no peito há 2 dias')
    expect(prompt).toContain('HAS')
    expect(prompt).toContain('medium')
  })

  it('instrui a IA a responder APENAS como paciente', () => {
    const prompt = buildPatientSystemPrompt(mockPatient as Patient)
    expect(prompt).toContain('paciente')
    expect(prompt).toContain('primeira pessoa')
  })
})

const chatHistory = [
  { role: 'student' as const, content: 'Há quanto tempo essa dor?', timestamp: '' },
  { role: 'patient' as const, content: 'Há 2 dias, doutor.', timestamp: '' },
]

describe('buildAnamnesisPrompt', () => {
  it('inclui a conversa formatada', () => {
    const prompt = buildAnamnesisPrompt(chatHistory)
    expect(prompt).toContain('Há quanto tempo essa dor?')
    expect(prompt).toContain('Há 2 dias, doutor.')
  })

  it('solicita JSON com os 5 campos da anamnese', () => {
    const prompt = buildAnamnesisPrompt(chatHistory)
    expect(prompt).toContain('hda')
    expect(prompt).toContain('hpp')
    expect(prompt).toContain('JSON')
  })
})

describe('buildFinishPrompt', () => {
  it('inclui dados do paciente e raciocínio clínico', () => {
    const prompt = buildFinishPrompt(mockPatient as Patient, 'Pensei em síndrome coronariana')
    expect(prompt).toContain('João Silva')
    expect(prompt).toContain('Pensei em síndrome coronariana')
  })

  it('pede apenas uma frase de estado clínico', () => {
    const prompt = buildFinishPrompt(mockPatient as Patient, '')
    expect(prompt).toContain('frase')
    expect(prompt.toLowerCase()).toContain('estado clínico')
  })
})

describe('buildCaseSummaryPrompt', () => {
  it('inclui as quatro seções rotuladas', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], '', [])
    expect(p).toContain('Medicações em uso:')
    expect(p).toContain('Exames já realizados:')
    expect(p).toContain('Evolução:')
    expect(p).toContain('Plano/pendências:')
  })

  it('incorpora o resumo anterior quando presente', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, 'RESUMO_ANTERIOR_XYZ', [], '', [])
    expect(p).toContain('RESUMO_ANTERIOR_XYZ')
  })

  it('lista os exames realizados e o pensamento clínico desta consulta', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], 'iniciei furosemida', [
      { exam_name: 'Ecocardiograma', result: 'FE 40%' },
    ])
    expect(p).toContain('Ecocardiograma')
    expect(p).toContain('iniciei furosemida')
  })

  it('proíbe inventar conduta e pede texto simples sem JSON', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], '', [])
    expect(p).toContain('NÃO invente')
    expect(p.toLowerCase()).toContain('sem json')
  })
})

describe('buildFinishPrompt — efeito do tratamento', () => {
  it('injeta prescrições ativas, adesão e a regra de efeito quando há tratamento', () => {
    const p = buildFinishPrompt(mockPatient as Patient, 'iniciei furosemida', {
      prescriptions: [{ drug_name: 'Furosemida', posology: '40 mg VO 1x/dia', adequacy: 'adequada' }],
      adherence: 'alta',
    })
    expect(p).toContain('PRESCRIÇÕES ATIVAS')
    expect(p).toContain('Furosemida')
    expect(p).toContain('alta')
    expect(p).toContain('adequada')
  })

  it('sem tratamento, mantém comportamento antigo (sem seção de prescrição)', () => {
    const p = buildFinishPrompt(mockPatient as Patient, 'observação')
    expect(p).not.toContain('PRESCRIÇÕES ATIVAS')
  })

  it('ignora a seção quando a lista de prescrições está vazia', () => {
    const p = buildFinishPrompt(mockPatient as Patient, 'x', { prescriptions: [], adherence: 'média' })
    expect(p).not.toContain('PRESCRIÇÕES ATIVAS')
  })
})

describe('buildCaseSummaryPrompt — efeito do tratamento', () => {
  it('lista as prescrições estruturadas e a adesão estimada', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], 'rx', [], {
      prescriptions: [{ drug_name: 'Losartana', posology: '50 mg', adequacy: 'adequada' }],
      adherence: 'baixa',
    })
    expect(p).toContain('Losartana')
    expect(p).toContain('baixa')
  })

  it('sem tratamento, indica adesão não avaliada e nenhuma prescrição', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], '', [])
    expect(p).toContain('(nenhuma prescrição registrada)')
    expect(p).toContain('(não avaliada)')
  })
})

describe('buildPatientSystemPrompt — memória do caso', () => {
  it('NÃO injeta memória na primeira consulta, mesmo com summary', () => {
    const p = buildPatientSystemPrompt(mockPatient as Patient, undefined, true, 'MEMORIA_XYZ')
    expect(p).not.toContain('MEMORIA_XYZ')
  })

  it('injeta memória em retorno quando há summary', () => {
    const p = buildPatientSystemPrompt(mockPatient as Patient, undefined, false, 'MEMORIA_XYZ')
    expect(p).toContain('MEMÓRIA DO CASO')
    expect(p).toContain('MEMORIA_XYZ')
  })

  it('não injeta bloco de memória em retorno sem summary', () => {
    const p = buildPatientSystemPrompt(mockPatient as Patient, undefined, false, null)
    expect(p).not.toContain('MEMÓRIA DO CASO')
  })
})
