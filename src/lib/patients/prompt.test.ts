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

  it('injeta a regra de especialidade e o domínio da especialidade escolhida', () => {
    const content = buildPatientPrompt('Pneumologia', 'hard').messages[0].content as string
    expect(content).toContain('REGRA DE ESPECIALIDADE')
    expect(content.toLowerCase()).toContain('manifestação principal')
    // domínio pulmonar deve aparecer para Pneumologia
    expect(content.toLowerCase()).toMatch(/dispneia|tosse|pleur/)
  })

  it('o domínio injetado varia conforme a especialidade', () => {
    const neuro = buildPatientPrompt('Neurologia', 'hard').messages[0].content as string
    expect(neuro.toLowerCase()).toMatch(/cefaleia|neurológic|déficit/)
    const gastro = buildPatientPrompt('Gastroenterologia', 'easy').messages[0].content as string
    expect(gastro.toLowerCase()).toMatch(/abdominal|digestiv|diarreia/)
  })

  it('permite diagnóstico de outra área desde que a apresentação seja do domínio', () => {
    const content = buildPatientPrompt('Pneumologia', 'hard').messages[0].content as string
    // a regra deve explicitar que o diagnóstico pode ser de outra especialidade
    expect(content.toLowerCase()).toMatch(/outra especialidade|outra área/)
  })
})
