import { describe, it, expect } from 'vitest'
import { displayIdentity, isValidHandle, suggestHandle } from './identity'

describe('displayIdentity', () => {
  it('modo real usa display_name + avatar_url', () => {
    const d = displayIdentity({ identity_mode: 'real', display_name: 'Ana Silva', avatar_url: 'http://x/a.png', leaderboard_alias: 'aninha', full_name: 'Ana S' })
    expect(d.name).toBe('Ana Silva'); expect(d.avatarUrl).toBe('http://x/a.png'); expect(d.initials).toBe('AS')
  })
  it('modo alias usa apelido e NÃO expõe avatar real', () => {
    const d = displayIdentity({ identity_mode: 'alias', display_name: 'Ana Silva', avatar_url: 'http://x/a.png', leaderboard_alias: 'aninha', full_name: 'Ana S' })
    expect(d.name).toBe('aninha'); expect(d.avatarUrl).toBeNull(); expect(d.initials).toBe('A')
  })
  it('alias sem apelido cai em "Aluno"', () => {
    const d = displayIdentity({ identity_mode: 'alias', display_name: null, avatar_url: null, leaderboard_alias: null, full_name: null })
    expect(d.name).toBe('Aluno')
  })
  it('real sem display_name cai no full_name', () => {
    const d = displayIdentity({ identity_mode: 'real', display_name: null, avatar_url: null, leaderboard_alias: null, full_name: 'Bruno Costa' })
    expect(d.name).toBe('Bruno Costa'); expect(d.initials).toBe('BC')
  })
})

describe('isValidHandle', () => {
  it('aceita 3-30 de [a-z0-9_.]', () => { expect(isValidHandle('ana_silva.1')).toBe(true) })
  it('rejeita maiúsculas, espaços, curto demais', () => {
    expect(isValidHandle('Ana')).toBe(false)
    expect(isValidHandle('ab')).toBe(false)
    expect(isValidHandle('a b')).toBe(false)
    expect(isValidHandle('')).toBe(false)
  })
})

describe('suggestHandle', () => {
  it('deriva do local-part do email, saneado', () => {
    expect(suggestHandle('Ana.Silva+test@gmail.com')).toBe('ana.silva')
  })
  it('garante tamanho mínimo com sufixo', () => {
    expect(suggestHandle('a@x.com').length).toBeGreaterThanOrEqual(3)
  })
})
