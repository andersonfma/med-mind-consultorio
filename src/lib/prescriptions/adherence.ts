import type { Adherence } from './types'

/**
 * Estima a adesão do paciente ao tratamento a partir do VÍNCULO (bond_level 1–5)
 * e da PERSONALIDADE (estilo de comunicação). Função pura e determinística — a
 * adesão alimenta o passo de efeito do tratamento no encerramento (não é gravada).
 *
 * Heurística: score = clamp(bond, 1..5) + modificador da personalidade.
 *   score >= 5 → 'alta'; 3–4 → 'média'; <= 2 → 'baixa'.
 */
const PERSONALITY_MOD: Record<string, number> = {
  objetivo: 1,     // cooperativo, segue orientação
  ansioso: 0,      // preocupado mas adere
  prolixo: -1,     // disperso, pode esquecer
  reticente: -1,   // desconfiado, adere menos
  minimizador: -2, // "não é nada", abandona tratamento
}

export function estimateAdherence(bondLevel: number, personality: string | null): Adherence {
  const bond = Math.max(1, Math.min(5, Math.round(bondLevel)))
  const mod = personality ? (PERSONALITY_MOD[personality] ?? 0) : 0
  const score = bond + mod
  if (score >= 5) return 'alta'
  if (score >= 3) return 'média'
  return 'baixa'
}

/**
 * Vínculo (bond_level 1–5) da PRÓXIMA consulta, por DOIS sinais:
 *  - comunicação (0–10) manda no sinal; A2 (0–10, raciocínio) amplifica quando a
 *    comunicação não é ruim.
 *  - comunicação boa (>=7): A2>=7 → +2, senão +1
 *  - comunicação ok (4–6): A2>=7 → +1, senão 0
 *  - comunicação ruim (<=3): −1 SEMPRE (comunicar mal reduz o vínculo, ignora A2)
 *  - communication === null (juiz falhou / ausente): comportamento antigo baseado só em A2.
 * Sempre com clamp em [1, 5].
 */
export function nextBondLevel(current: number, a2: number | null, communication: number | null = null): number {
  const base = Math.max(1, Math.min(5, Math.round(current)))
  const a2High = a2 !== null && a2 >= 7
  let inc: number
  if (communication === null) {
    inc = 1
    if (a2 !== null) {
      if (a2 >= 7) inc = 2
      else if (a2 <= 3) inc = 0
    }
  } else if (communication <= 3) {
    inc = -1
  } else if (communication <= 6) {
    inc = a2High ? 1 : 0
  } else {
    inc = a2High ? 2 : 1
  }
  return Math.max(1, Math.min(5, base + inc))
}
