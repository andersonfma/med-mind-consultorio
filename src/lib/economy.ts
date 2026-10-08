export const STAKES = [10, 25, 50] as const
export const HOUSE_MIN = 10
export const DOUBT_REWARD = 15
export const DOUBT_WINDOW_MIN = 30
const STREAK_CAP = 2.0

export type Stage = 'anamnese' | 'exame' | 'complementares' | 'conduta' | 'conclusao'

export function dayFactor(stage: Stage): number {
  return stage === 'conclusao' ? 2 : 1
}

/** Faixa efetiva: 0 (sem aposta) sempre; 10 sempre (casa); 25/50 rebaixam até caber (mín 10). */
export function allowedStake(stake: number, balance: number): number {
  if (stake <= 0) return 0
  if (stake <= HOUSE_MIN) return HOUSE_MIN
  const affordable = STAKES.filter(s => s <= stake && (s === HOUSE_MIN || s <= balance))
  return affordable.length ? Math.max(...affordable) : HOUSE_MIN
}

export function streakFactor(streak: number): number {
  return Math.min(1 + 0.1 * (Math.max(1, streak) - 1), STREAK_CAP)
}

export function resolveBet(
  stake: number, isCorrect: boolean, balance: number, dFactor: number, sFactor: number,
): { delta: number; effStake: number } {
  const effStake = allowedStake(stake, balance)
  if (effStake === 0) return { delta: 0, effStake: 0 }
  if (isCorrect) return { delta: Math.round(effStake * dFactor * sFactor), effStake }
  const loss = Math.min(effStake, Math.max(0, balance))
  return { delta: loss === 0 ? 0 : -loss, effStake }
}

function dayDiff(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + 'T00:00:00Z')
  const b = Date.parse(bISO + 'T00:00:00Z')
  return Math.round((b - a) / 86400000)
}

/** Novo streak dado o último dia respondido, hoje (YYYY-MM-DD) e o streak atual. */
export function nextStreak(lastDate: string | null, today: string, currentStreak = 0): number {
  if (!lastDate) return 1
  const d = dayDiff(lastDate, today)
  if (d === 0) return currentStreak || 1   // já respondeu hoje
  if (d === 1) return currentStreak + 1    // dia consecutivo
  return 1                                  // pulou
}

export function isDayOpen(revealDate: string, today: string): boolean {
  return dayDiff(revealDate, today) >= 0
}
