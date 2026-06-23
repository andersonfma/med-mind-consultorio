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
