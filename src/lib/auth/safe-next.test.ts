import { describe, it, expect } from 'vitest'
import { getSafeNext } from './safe-next'
import { DASHBOARD_ROUTE } from '../routes'

describe('getSafeNext', () => {
  it('aceita caminhos relativos normais', () => {
    expect(getSafeNext('/dashboard')).toBe('/dashboard')
    expect(getSafeNext('/consulta/123')).toBe('/consulta/123')
  })

  it('retorna DASHBOARD_ROUTE para null', () => {
    expect(getSafeNext(null)).toBe(DASHBOARD_ROUTE)
  })

  it('retorna DASHBOARD_ROUTE para string vazia', () => {
    expect(getSafeNext('')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia protocol-relative // (open redirect)', () => {
    expect(getSafeNext('//evil.com')).toBe(DASHBOARD_ROUTE)
    expect(getSafeNext('//evil.com/path')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia backslash /\\ (open redirect em Windows)', () => {
    expect(getSafeNext('/\\')).toBe(DASHBOARD_ROUTE)
    expect(getSafeNext('/\\evil.com')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia URLs absolutas sem barra inicial', () => {
    expect(getSafeNext('https://evil.com')).toBe(DASHBOARD_ROUTE)
    expect(getSafeNext('http://evil.com')).toBe(DASHBOARD_ROUTE)
  })

  it('bloqueia caminhos relativos sem barra inicial', () => {
    expect(getSafeNext('evil')).toBe(DASHBOARD_ROUTE)
  })
})
