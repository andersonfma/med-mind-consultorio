import { describe, it, expect } from 'vitest'
import { voiceForGender } from './voices'

describe('voiceForGender', () => {
  it('paciente masculino → onyx', () => {
    expect(voiceForGender('M')).toBe('onyx')
  })
  it('paciente feminino → shimmer', () => {
    expect(voiceForGender('F')).toBe('shimmer')
  })
  it('valor desconhecido/vazio → voz feminina padrão (shimmer)', () => {
    expect(voiceForGender('')).toBe('shimmer')
    expect(voiceForGender('X')).toBe('shimmer')
  })
})
