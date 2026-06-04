import { describe, it, expect } from 'vitest'
import { getRedirectPath } from './redirect'
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '../routes'

describe('getRedirectPath', () => {
  it('redireciona usuário não autenticado do dashboard para login', () => {
    expect(getRedirectPath('/dashboard', false)).toBe(LOGIN_ROUTE)
  })

  it('redireciona usuário não autenticado de rota privada qualquer para login', () => {
    expect(getRedirectPath('/patients', false)).toBe(LOGIN_ROUTE)
  })

  it('redireciona usuário autenticado do login para dashboard', () => {
    expect(getRedirectPath('/login', true)).toBe(DASHBOARD_ROUTE)
  })

  it('redireciona usuário autenticado do register para dashboard', () => {
    expect(getRedirectPath('/register', true)).toBe(DASHBOARD_ROUTE)
  })

  it('redireciona usuário autenticado do reset-password para dashboard', () => {
    expect(getRedirectPath('/reset-password', true)).toBe(DASHBOARD_ROUTE)
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
