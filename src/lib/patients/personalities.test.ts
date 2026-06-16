import { describe, it, expect } from 'vitest'
import { PERSONALITIES, pickPersonality, personalitySection } from './personalities'

describe('pickPersonality (regra de alternância)', () => {
  it('sem anterior, começa pela primeira da lista', () => {
    expect(pickPersonality(null)).toBe(PERSONALITIES[0].key)
    expect(pickPersonality(undefined)).toBe(PERSONALITIES[0].key)
  })

  it('rotaciona para a PRÓXIMA, evitando repetir a anterior', () => {
    for (let i = 0; i < PERSONALITIES.length; i++) {
      const expected = PERSONALITIES[(i + 1) % PERSONALITIES.length].key
      expect(pickPersonality(PERSONALITIES[i].key)).toBe(expected)
    }
  })

  it('nunca repete a personalidade imediatamente anterior', () => {
    for (const p of PERSONALITIES) {
      expect(pickPersonality(p.key)).not.toBe(p.key)
    }
  })

  it('dá a volta no ciclo após a última', () => {
    const last = PERSONALITIES[PERSONALITIES.length - 1].key
    expect(pickPersonality(last)).toBe(PERSONALITIES[0].key)
  })

  it('personalidade desconhecida cai no início (compat com pacientes antigos)', () => {
    expect(pickPersonality('inexistente')).toBe(PERSONALITIES[0].key)
  })
})

describe('personalitySection', () => {
  it('retorna o bloco de prompt para uma personalidade válida', () => {
    const s = personalitySection('minimizador')
    expect(s).toContain('PERSONALIDADE')
    expect(s.toLowerCase()).toMatch(/minimiza|subestima/)
  })

  it('retorna string vazia para personalidade ausente/desconhecida', () => {
    expect(personalitySection(null)).toBe('')
    expect(personalitySection(undefined)).toBe('')
    expect(personalitySection('inexistente')).toBe('')
  })
})
