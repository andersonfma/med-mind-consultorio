export type LeaderRow = { rank: number; name: string; xp: number; cases: number; isMe: boolean }
export type Leaderboard = { top: LeaderRow[]; me: LeaderRow | null }

export type ConsultRow = { user_id: string; points: number | null }
export type ProfileRow = { id: string; full_name: string | null; leaderboard_optin: boolean | null; leaderboard_alias: string | null }

/** Segunda-feira 00:00 (UTC) da semana corrente — início da janela "Semana". */
export function weekStartISO(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() // 0=dom..6=sáb
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString()
}

/**
 * Monta o ranking a partir das consultas finalizadas (com pontos) e dos perfis.
 * Função PURA — a página faz as queries (filtro de período inclusive) e passa os dados.
 * Só emite campos seguros: posição, nome/apelido OU "Anônimo" (respeita opt-in), XP, casos.
 */
export function computeLeaderboard(
  consults: ConsultRow[],
  profiles: ProfileRow[],
  currentUserId: string,
  topN = 50,
): Leaderboard {
  const xp = new Map<string, number>()
  const cases = new Map<string, number>()
  for (const c of consults) {
    const p = c.points ?? 0
    if (p <= 0) continue
    xp.set(c.user_id, (xp.get(c.user_id) ?? 0) + p)
    cases.set(c.user_id, (cases.get(c.user_id) ?? 0) + 1)
  }

  const profById = new Map(profiles.map(p => [p.id, p]))
  const displayName = (uid: string) => {
    const p = profById.get(uid)
    if (p?.leaderboard_optin) return (p.leaderboard_alias?.trim() || p.full_name?.trim() || 'Aluno')
    return 'Anônimo'
  }

  const ranked = [...xp.entries()]
    .map(([uid, points]) => ({ uid, xp: points, cases: cases.get(uid) ?? 0 }))
    .sort((a, b) => b.xp - a.xp || b.cases - a.cases)

  const top: LeaderRow[] = ranked.slice(0, topN).map((r, i) => ({
    rank: i + 1,
    name: r.uid === currentUserId ? 'Você' : displayName(r.uid),
    xp: r.xp,
    cases: r.cases,
    isMe: r.uid === currentUserId,
  }))

  const myIdx = ranked.findIndex(r => r.uid === currentUserId)
  const me: LeaderRow | null = myIdx >= 0
    ? { rank: myIdx + 1, name: 'Você', xp: ranked[myIdx].xp, cases: ranked[myIdx].cases, isMe: true }
    : null

  return { top, me }
}
