import { describe, it, expect } from 'vitest'
import { buildCommunicationPrompt } from './communication-prompts'
import type { Patient } from '@/types/domain'

const patient = { name: 'João', age: 50, chief_complaint: 'dor no peito' } as unknown as Patient
const chat = [
  { role: 'student' as const, content: 'Bom dia, o que o traz aqui?', timestamp: 't' },
  { role: 'patient' as const, content: 'uma dor no peito', timestamp: 't' },
]

describe('buildCommunicationPrompt', () => {
  it('inclui as 3 facetas nomeadas', () => {
    const p = buildCommunicationPrompt(patient, chat)
    expect(p).toMatch(/C1/); expect(p).toMatch(/clareza|linguagem|termos/i)
    expect(p).toMatch(/C2/); expect(p).toMatch(/empatia|acolhimento/i)
    expect(p).toMatch(/C3/); expect(p).toMatch(/condu[çc]/i)
  })

  it('traz a trava de independência (não avaliar acerto do diagnóstico)', () => {
    const p = buildCommunicationPrompt(patient, chat)
    expect(p).toMatch(/independente|não.*(premie|penalize|acert)/i)
  })

  it('inclui a conversa e pede JSON com c1/c2/c3/recommendation', () => {
    const p = buildCommunicationPrompt(patient, chat)
    expect(p).toContain('dor no peito')
    expect(p).toContain('"c1"'); expect(p).toContain('"c2"'); expect(p).toContain('"c3"')
    expect(p).toContain('"recommendation"')
  })
})
