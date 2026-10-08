import { describe, it, expect } from 'vitest'
import { buildWeeklyCasePrompt, parseWeeklyCase } from './prompts'

describe('buildWeeklyCasePrompt', () => {
  it('pede Clínica Médica, 5 etapas nomeadas e JSON', () => {
    const p = buildWeeklyCasePrompt()
    expect(p).toMatch(/Clínica Médica/)
    for (const s of ['anamnese', 'exame', 'complementares', 'conduta', 'conclusao']) expect(p).toContain(s)
    expect(p).toMatch(/JSON/i)
  })
})

describe('parseWeeklyCase', () => {
  it('valida 5 dias, options 2-5 e correct_key presente', () => {
    const good = JSON.stringify({
      title: 'x', true_diagnosis: 'y', overview: 'o', review: 'r',
      days: ['anamnese', 'exame', 'complementares', 'conduta', 'conclusao'].map((stage, i) => ({
        day_index: i + 1, stage, narrative: 'n',
        quiz: { prompt: 'p', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correct_key: 'A', explanation: 'e' },
      })),
    })
    expect(parseWeeklyCase(good)?.days.length).toBe(5)
  })
  it('rejeita correct_key ausente das options', () => {
    const bad = JSON.stringify({ title: 'x', true_diagnosis: 'y', overview: 'o', review: 'r', days: [{ day_index: 1, stage: 'anamnese', narrative: 'n', quiz: { prompt: 'p', options: [{ key: 'A', text: 'a' }], correct_key: 'Z' } }] })
    expect(parseWeeklyCase(bad)).toBeNull()
  })
  it('rejeita quando não há 5 dias', () => {
    const bad = JSON.stringify({ title: 'x', true_diagnosis: 'y', overview: 'o', review: 'r', days: [] })
    expect(parseWeeklyCase(bad)).toBeNull()
  })
})
