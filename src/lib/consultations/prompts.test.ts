import { describe, it, expect } from 'vitest'
import { buildPatientSystemPrompt, buildAnamnesisPrompt, buildFinishPrompt, buildCaseSummaryPrompt, type TreatmentContext } from './prompts'
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
  it('injeta conduta ativa, adesão e a adequação global quando há tratamento', () => {
    const p = buildFinishPrompt(mockPatient as Patient, 'iniciei furosemida', {
      prescriptions: [{ drug_name: 'Furosemida', posology: '40 mg VO 1x/dia', adequacy: 'adequada', kind: 'medicamento' }],
      adherence: 'alta',
      conductAdequacy: 'adequada',
    })
    expect(p).toContain('CONDUTA ATIVA')
    expect(p).toContain('Furosemida')
    expect(p).toContain('alta')
    expect(p).toContain('adequada')
  })

  it('sem tratamento, mantém comportamento antigo (sem seção de conduta)', () => {
    const p = buildFinishPrompt(mockPatient as Patient, 'observação')
    expect(p).not.toContain('CONDUTA ATIVA')
  })

  it('ignora a seção quando a lista de prescrições está vazia', () => {
    const p = buildFinishPrompt(mockPatient as Patient, 'x', { prescriptions: [], adherence: 'média', conductAdequacy: 'inadequada' })
    expect(p).not.toContain('CONDUTA ATIVA')
  })
})

describe('buildCaseSummaryPrompt — efeito do tratamento', () => {
  it('lista a conduta estruturada (com kind) e a adesão estimada', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], 'rx', [], {
      prescriptions: [{ drug_name: 'Losartana', posology: '50 mg', adequacy: 'adequada', kind: 'medicamento' }],
      adherence: 'baixa',
      conductAdequacy: 'adequada',
    })
    expect(p).toContain('Losartana')
    expect(p).toContain('baixa')
    expect(p).toContain('Adequação global da conduta: adequada')
  })

  it('sem tratamento, indica adesão e adequação não avaliadas e nenhuma conduta', () => {
    const p = buildCaseSummaryPrompt(mockPatient as Patient, null, [], '', [])
    expect(p).toContain('(nenhuma conduta registrada)')
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

describe('buildFinishPrompt — matriz de evolução', () => {
  const matrixPatient = {
    name: 'Celina', age: 60, specialty: 'Clínica Médica',
    chief_complaint: 'vômito com sangue', clinical_status: 'sangramento ativo',
    true_diagnosis: 'Hemorragia varicosa',
  } as unknown as Patient

  function tx(conductAdequacy: TreatmentContext['conductAdequacy'], adherence: TreatmentContext['adherence']): TreatmentContext {
    return {
      prescriptions: [{ drug_name: 'terlipressina', posology: '2mg 4/4h', adequacy: 'parcial', kind: 'medicamento' }],
      adherence,
      conductAdequacy,
    }
  }

  it('conduta adequada nunca gera piora (regra dura no prompt)', () => {
    const p = buildFinishPrompt(matrixPatient, 'HDA por varizes', tx('adequada', 'baixa'))
    expect(p).toMatch(/adequada.*(nunca|jamais).*(piora|sem melhora)/i)
  })

  it('usa a nota GLOBAL da conduta, não a adequação por item', () => {
    const p = buildFinishPrompt(matrixPatient, 'raciocínio', tx('adequada', 'alta'))
    expect(p).toMatch(/conjunto|global/i)
    expect(p).toContain('adequada')
  })

  it('sem tratamento, mantém o ramo de heurística do pensamento clínico', () => {
    const p = buildFinishPrompt(matrixPatient, 'raciocínio', undefined)
    expect(p).toMatch(/pensamento clínico/i)
  })
})

describe('buildPatientSystemPrompt — medicações em uso', () => {
  it('injeta as medicações ativas quando há prescrições', () => {
    const p = buildPatientSystemPrompt(mockPatient as Patient, undefined, false, null, ['Losartana', 'AAS'])
    expect(p).toContain('MEDICAÇÕES EM USO')
    expect(p).toContain('Losartana')
    expect(p).toContain('AAS')
  })

  it('não injeta o bloco quando não há medicações', () => {
    const p = buildPatientSystemPrompt(mockPatient as Patient, undefined, false, null, [])
    expect(p).not.toContain('MEDICAÇÕES EM USO')
  })
})
