import { describe, it, expect } from 'vitest'
import { getSafeNext } from './safe-next'

describe('getSafeNext', () => {
  it('aceita caminhos relativos normais', () => {
    expect(getSafeNext('/dashboard')).toBe('/dashboard')
    expect(getSafeNext('/consulta/123')).toBe('/consulta/123')
  })

  it('retorna /dashboard para null', () => {
    expect(getSafeNext(null)).toBe('/dashboard')
  })

  it('retorna /dashboard para string vazia', () => {
    expect(getSafeNext('')).toBe('/dashboard')
  })

  it('bloqueia protocol-relative // (open redirect)', () => {
    expect(getSafeNext('//evil.com')).toBe('/dashboard')
    expect(getSafeNext('//evil.com/path')).toBe('/dashboard')
  })

  it('bloqueia backslash /\\ (open redirect em Windows)', () => {
    expect(getSafeNext('/\\')).toBe('/dashboard')
    expect(getSafeNext('/\\evil.com')).toBe('/dashboard')
  })

  it('bloqueia URLs absolutas sem barra inicial', () => {
    expect(getSafeNext('https://evil.com')).toBe('/dashboard')
    expect(getSafeNext('http://evil.com')).toBe('/dashboard')
  })

  it('bloqueia caminhos relativos sem barra inicial', () => {
    expect(getSafeNext('evil')).toBe('/dashboard')
  })
})
