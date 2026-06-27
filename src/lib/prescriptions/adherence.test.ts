import { describe, it, expect } from 'vitest'
import { estimateAdherence } from './adherence'

describe('estimateAdherence', () => {
  it('vínculo alto + cooperativo → alta', () => {
    expect(estimateAdherence(5, 'objetivo')).toBe('alta')
    expect(estimateAdherence(4, 'objetivo')).toBe('alta')
  })

  it('vínculo baixo + minimizador → baixa', () => {
    expect(estimateAdherence(1, 'minimizador')).toBe('baixa')
    expect(estimateAdherence(2, 'reticente')).toBe('baixa')
  })

  it('vínculo intermediário → média', () => {
    expect(estimateAdherence(3, 'ansioso')).toBe('média')
  })

  it('bom vínculo não salva um minimizador (puxa para média)', () => {
    expect(estimateAdherence(5, 'minimizador')).toBe('média')
  })

  it('personalidade desconhecida/null usa só o vínculo', () => {
    expect(estimateAdherence(5, null)).toBe('alta')
    expect(estimateAdherence(1, 'inexistente')).toBe('baixa')
    expect(estimateAdherence(3, null)).toBe('média')
  })

  it('faz clamp de vínculo fora de 1–5', () => {
    expect(estimateAdherence(0, 'objetivo')).toBe('baixa') // bond clamp=1, +1=2 → baixa
    expect(estimateAdherence(99, 'objetivo')).toBe('alta')
  })
})
