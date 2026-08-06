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

describe('nextBondLevel — vínculo v2 (A2 + comunicação)', () => {
  it('comunicação boa (>=7): A2 alto → +2, A2 não-alto → +1', () => {
    expect(nextBondLevel(1, 8, 8)).toBe(3)   // +2
    expect(nextBondLevel(1, 4, 8)).toBe(2)   // +1
    expect(nextBondLevel(1, null, 9)).toBe(2) // a2 null = não-alto → +1
  })

  it('comunicação ok (4–6): A2 alto → +1, senão 0', () => {
    expect(nextBondLevel(2, 8, 5)).toBe(3)   // +1
    expect(nextBondLevel(2, 3, 5)).toBe(2)   // 0
  })

  it('comunicação ruim (<=3): reduz o vínculo (−1) IGNORANDO o A2', () => {
    expect(nextBondLevel(3, 10, 2)).toBe(2)  // −1 mesmo com A2 alto
    expect(nextBondLevel(3, null, 0)).toBe(2)
  })

  it('clamp no piso 1 e no teto 5', () => {
    expect(nextBondLevel(1, 0, 1)).toBe(1)   // 1 + (−1) = 0 → clamp 1
    expect(nextBondLevel(5, 9, 9)).toBe(5)   // 5 + 2 → clamp 5
  })

  it('communication null → comportamento antigo (só A2)', () => {
    expect(nextBondLevel(1, 8, null)).toBe(3)  // +2
    expect(nextBondLevel(2, 2, null)).toBe(2)  // +0
    expect(nextBondLevel(1, 5, null)).toBe(2)  // +1
    expect(nextBondLevel(1, null, null)).toBe(2) // +1
  })
})
