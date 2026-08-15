import { describe, it, expect } from 'vitest'
import { buildRadarInput, computeRadar, radarFromRows } from './radar'
import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

const ab4 = (overall: number, recommendation = 'ok') => ({ overall, recommendation })
const comm = (overall: number, recommendation = 'ok') => ({ overall, recommendation })

describe('buildRadarInput', () => {
  it('coleta overalls de AB4 e comunicação só de consultas finished', () => {
    const input = buildRadarInput({
      consultations: [
        { ab4_score: ab4(8), communication_score: comm(6), status: 'finished' },
        { ab4_score: ab4(4), communication_score: comm(4), status: 'active' }, // ignorada
      ],
      patients: [], exams: [], prescriptions: [],
    })
    expect(input.ab4Overalls).toEqual([8])
    expect(input.communicationOveralls).toEqual([6])
    expect(input.n).toBe(1)
    // raciocínio de fato registrado → esperado e feito
    expect(input.reasoningExpected).toBe(1)
  })

  it('trata score "vazio" (sentinela) como NÃO medido (não entra, não vira 0) mas conta como esperado', () => {
    const input = buildRadarInput({
      consultations: [
        { ab4_score: ab4(0, EMPTY_REASONING_RECOMMENDATION), communication_score: comm(0, EMPTY_COMMUNICATION_RECOMMENDATION), status: 'finished' },
      ],
      patients: [], exams: [], prescriptions: [],
    })
    expect(input.ab4Overalls).toEqual([])
    expect(input.communicationOveralls).toEqual([])
    expect(input.n).toBe(1)
    // deixou o raciocínio em branco quando era esperado → entra no denominador da cobertura
    expect(input.reasoningExpected).toBe(1)
  })

  it('ignora ab4_score null (seguimento): não conta como esperado, mas mantém comunicação', () => {
    const input = buildRadarInput({
      consultations: [
        { ab4_score: null, communication_score: comm(7), status: 'finished' },
      ],
      patients: [], exams: [], prescriptions: [],
    })
    expect(input.ab4Overalls).toEqual([])
    expect(input.communicationOveralls).toEqual([7])
    // seguimento não espera raciocínio → não penaliza a cobertura
    expect(input.reasoningExpected).toBe(0)
  })

  it('filtra diagnósticos fechados, exames decididos e condutas avaliadas', () => {
    const input = buildRadarInput({
      consultations: [],
      patients: [{ diagnosis_status: 'achieved' }, { diagnosis_status: 'revealed' }, { diagnosis_status: 'none' }],
      exams: [{ status: 'approved' }, { status: 'rejected' }, { status: 'pending' }],
      prescriptions: [{ adequacy: 'adequada' }, { adequacy: 'parcial' }, { adequacy: null }],
    })
    expect(input.diagnoses).toEqual(['achieved', 'revealed'])
    expect(input.examDecisions).toEqual(['approved', 'rejected'])
    expect(input.conductAdequacies).toEqual(['adequada', 'parcial'])
  })
})

describe('computeRadar', () => {
  const empty = { ab4Overalls: [], communicationOveralls: [], diagnoses: [], examDecisions: [], conductAdequacies: [], reasoningExpected: 0, n: 0 }

  it('médias dos três eixos quando há dado', () => {
    const r = computeRadar({
      ab4Overalls: [8, 6], communicationOveralls: [7], reasoningExpected: 2, n: 2,
      diagnoses: ['achieved', 'revealed'],      // 1/2 → 5
      examDecisions: ['approved', 'approved', 'rejected'], // 2/3 → 6.67
      conductAdequacies: ['adequada', 'parcial'], // (10+5)/2 → 7.5
    })
    expect(r.pensamentoClinico).toBe(7)
    expect(r.comunicacao).toBe(7)
    // técnica = média(5, 6.7, 7.5) = 6.4
    expect(r.tecnica).toBe(6.4)
    expect(r.n).toBe(2)
    expect(r.reasoningCoverage).toEqual({ reasoned: 2, expected: 2 })
  })

  it('cobertura reflete raciocínios em branco: 1 de 3 esperados', () => {
    const r = computeRadar({ ...empty, ab4Overalls: [8], reasoningExpected: 3, n: 3 })
    // média do eixo continua limpa (só a qualidade do que foi raciocinado)
    expect(r.pensamentoClinico).toBe(8)
    // mas a cobertura mostra que 2 de 3 ficaram em branco
    expect(r.reasoningCoverage).toEqual({ reasoned: 1, expected: 3 })
  })

  it('sem raciocínio esperado (só seguimentos) → cobertura null', () => {
    const r = computeRadar({ ...empty, communicationOveralls: [7], reasoningExpected: 0, n: 1 })
    expect(r.reasoningCoverage).toBeNull()
  })

  it('técnica usa só as submétricas presentes (omite as vazias)', () => {
    const r = computeRadar({ ...empty, diagnoses: ['achieved'], n: 1 }) // só acurácia = 10
    expect(r.tecnica).toBe(10)
  })

  it('eixo sem dado → null (nunca 0)', () => {
    const r = computeRadar(empty)
    expect(r.pensamentoClinico).toBeNull()
    expect(r.comunicacao).toBeNull()
    expect(r.tecnica).toBeNull()
    expect(r.n).toBe(0)
    expect(r.reasoningCoverage).toBeNull()
  })

  it('radarFromRows integra build + compute (incluindo cobertura)', () => {
    const r = radarFromRows({
      consultations: [
        { ab4_score: ab4(8), communication_score: comm(6), status: 'finished' },        // raciocinou
        { ab4_score: ab4(0, EMPTY_REASONING_RECOMMENDATION), communication_score: comm(4), status: 'finished' }, // em branco
        { ab4_score: null, communication_score: comm(8), status: 'finished' },           // seguimento
      ],
      patients: [{ diagnosis_status: 'achieved' }],
      exams: [], prescriptions: [],
    })
    expect(r).toEqual({
      pensamentoClinico: 8,                 // só a consulta raciocinada entra na média
      comunicacao: 6,                       // média(6, 4, 8) = 6
      tecnica: 10,
      n: 3,
      reasoningCoverage: { reasoned: 1, expected: 2 }, // seguimento não conta como esperado
    })
  })
})
