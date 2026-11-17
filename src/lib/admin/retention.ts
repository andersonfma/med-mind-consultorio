export type Feature = 'simulador' | 'desafio' | 'simulados' | 'mapas' | 'social'
export const FEATURES: { key: Feature; label: string }[] = [
  { key: 'simulador', label: 'Simulador' },
  { key: 'desafio', label: 'Desafio' },
  { key: 'simulados', label: 'Simulados' },
  { key: 'mapas', label: 'Mapas' },
  { key: 'social', label: 'Spaces' },
]
export type ActivityEvent = { feature: Feature; ts: number }
export type UserActivity = { id: string; signup: number; events: ActivityEvent[] }

const DAY = 86_400_000

export function isMature(u: UserActivity, now: number, days = 7): boolean {
  return now - u.signup >= days * DAY
}
export function isRetainedD7(u: UserActivity, now: number): boolean {
  const cutoff = u.signup + 7 * DAY
  return u.events.some((e) => e.ts >= cutoff)
}
function adoptedEarly(u: UserActivity, feature: Feature): boolean {
  const window = u.signup + 7 * DAY
  return u.events.some((e) => e.feature === feature && e.ts <= window)
}

export function retentionD7(users: UserActivity[], now: number) {
  const mature = users.filter((u) => isMature(u, now))
  const retained = mature.filter((u) => isRetainedD7(u, now))
  return { eligible: mature.length, retained: retained.length, pct: mature.length ? Math.round((retained.length / mature.length) * 100) : 0 }
}

export function retentionCurve(users: UserActivity[], now: number, marks: number[] = [1, 7, 14, 30]) {
  return marks.map((n) => {
    const eligible = users.filter((u) => now - u.signup >= n * DAY)
    const retained = eligible.filter((u) => u.events.some((e) => e.ts >= u.signup + n * DAY))
    return { dayMark: n, eligible: eligible.length, retained: retained.length, pct: eligible.length ? Math.round((retained.length / eligible.length) * 100) : 0 }
  })
}

export function featureLift(users: UserActivity[], now: number) {
  const mature = users.filter((u) => isMature(u, now))
  return FEATURES.map(({ key, label }) => {
    const adopters = mature.filter((u) => adoptedEarly(u, key))
    const nonAdopters = mature.filter((u) => !adoptedEarly(u, key))
    const rate = (arr: UserActivity[]) => (arr.length ? Math.round((arr.filter((u) => isRetainedD7(u, now)).length / arr.length) * 100) : 0)
    const retAdopt = rate(adopters)
    const retNon = rate(nonAdopters)
    return { feature: key, label, adopters: adopters.length, nonAdopters: nonAdopters.length, retAdopt, retNon, lift: retAdopt - retNon }
  }).sort((a, b) => b.lift - a.lift)
}
