import { describe, it, expect } from 'vitest'
import { getRedirectPath } from './redirect'

describe('getRedirectPath', () => {
  it('redireciona usuário não autenticado do dashboard para login', () => {
    expect(getRedirectPath('/dashboard', false)).toBe('/login')
  })

  it('redireciona usuário não autenticado de rota privada qualquer para login', () => {
    expect(getRedirectPath('/patients', false)).toBe('/login')
  })

  it('redireciona usuário autenticado do login para dashboard', () => {
    expect(getRedirectPath('/login', true)).toBe('/dashboard')
  })

  it('redireciona usuário autenticado do register para dashboard', () => {
    expect(getRedirectPath('/register', true)).toBe('/dashboard')
  })

  it('redireciona usuário autenticado do reset-password para dashboard', () => {
    expect(getRedirectPath('/reset-password', true)).toBe('/dashboard')
  })

  it('permite usuário não autenticado na página de login', () => {
    expect(getRedirectPath('/login', false)).toBeNull()
  })

  it('permite usuário não autenticado no register', () => {
    expect(getRedirectPath('/register', false)).toBeNull()
  })

  it('permite usuário autenticado no dashboard', () => {
    expect(getRedirectPath('/dashboard', true)).toBeNull()
  })
})
