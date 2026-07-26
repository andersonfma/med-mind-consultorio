import { describe, it, expect } from 'vitest'
import { estimateAdherence, nextBondLevel } from './adherence'

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

describe('nextBondLevel', () => {
  it('A2 alto (>=7) acelera: +2', () => {
    expect(nextBondLevel(1, 8)).toBe(3)
    expect(nextBondLevel(2, 7)).toBe(4)
  })

  it('A2 baixo (<=3) trava: +0', () => {
    expect(nextBondLevel(2, 2)).toBe(2)
    expect(nextBondLevel(1, 0)).toBe(1)
  })

  it('A2 intermediário: +1', () => {
    expect(nextBondLevel(1, 5)).toBe(2)
    expect(nextBondLevel(3, 6)).toBe(4)
  })

  it('sem AB4 (a2 null): +1 puro', () => {
    expect(nextBondLevel(1, null)).toBe(2)
    expect(nextBondLevel(4, null)).toBe(5)
  })

  it('faz clamp no teto 5 e no piso 1', () => {
    expect(nextBondLevel(5, 9)).toBe(5)
    expect(nextBondLevel(4, 8)).toBe(5)
    expect(nextBondLevel(0, 2)).toBe(1) // current clamp=1, +0
  })
})
