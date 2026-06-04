import { describe, it, expect } from 'vitest'
import { buildPatientPrompt } from './prompt'

describe('buildPatientPrompt', () => {
  it('usa gpt-4o-mini', () => {
    const params = buildPatientPrompt('Cardiologia', 'easy')
    expect(params.model).toBe('gpt-4o-mini')
  })

  it('usa response_format json_object', () => {
    const params = buildPatientPrompt('Cardiologia', 'easy')
    expect(params.response_format).toEqual({ type: 'json_object' })
  })

  it('tem exatamente uma mensagem com role user', () => {
    const params = buildPatientPrompt('Cardiologia', 'easy')
    expect(params.messages).toHaveLength(1)
    expect(params.messages[0].role).toBe('user')
  })

  it('interpola especialidade e dificuldade no conteúdo', () => {
    const params = buildPatientPrompt('Neurologia', 'hard')
    const content = params.messages[0].content as string
    expect(content).toContain('Neurologia')
    expect(content).toContain('hard')
  })

  it('contém a palavra JSON no conteúdo (obrigatório pela OpenAI API)', () => {
    const params = buildPatientPrompt('Infectologia', 'medium')
    const content = params.messages[0].content as string
    expect(content.toUpperCase()).toContain('JSON')
  })
})
