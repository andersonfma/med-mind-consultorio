import type { Difficulty } from '@/lib/patients/specialties'

/** Bônus de pontos quando o diagnóstico é "alcançado" (raciocínio bateu). */
export const ACHIEVED_BONUS = 15

const WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 35 }

const clamp10 = (v: number) => Math.max(0, Math.min(10, v))

/**
 * Pontos (XP) de UMA consulta finalizada.
 *   pontos = round(peso_dificuldade × fator_qualidade)
 *   fator  = 0,5 + nota/20  → 0,5 (nota 0) a 1,0 (nota 10)
 * Sem AB4 (ab4Overall null) → fator mínimo 0,5 (ainda premia a prática).
 */
export function computePoints(difficulty: Difficulty, ab4Overall: number | null | undefined): number {
  const weight = WEIGHT[difficulty] ?? WEIGHT.easy
  const factor = 0.5 + clamp10(typeof ab4Overall === 'number' ? ab4Overall : 0) / 20
  return Math.round(weight * factor)
}
