import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type Space = {
  id: string; slug: string; name: string; description: string | null
  owner_id: string; institution_id: string | null
  join_policy: 'request' | 'invite' | 'open'; visibility: 'public' | 'private'; is_active: boolean
  invite_token: string | null
}
export type Membership = { role: 'admin' | 'moderator' | 'member'; status: 'pending' | 'active' | 'banned' } | null
export type MemberRow = {
  user_id: string; role: string; status: string; requested_at: string
  name: string | null
}

export async function getSpaceBySlug(slug: string): Promise<Space | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('spaces').select('*').eq('slug', slug.toLowerCase()).maybeSingle()
  return (data as Space | null) ?? null
}

export async function getMembership(spaceId: string, userId: string): Promise<Membership> {
  const admin = createAdminClient()
  const { data } = await admin.from('space_members').select('role, status').eq('space_id', spaceId).eq('user_id', userId).maybeSingle()
  return (data as Membership) ?? null
}

export async function listMembers(spaceId: string): Promise<MemberRow[]> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('space_members')
    .select('user_id, role, status, requested_at').eq('space_id', spaceId)
  const members = (rows ?? []) as Array<Omit<MemberRow, 'name'>>
  if (members.length === 0) return []
  const ids = members.map((m) => m.user_id)
  const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', ids)
  const nameById = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]))
  return members.map((m) => ({ ...m, name: nameById.get(m.user_id) ?? null }))
}

export type DiscoverSpace = Space & { members: number; myStatus: string | null }

/** Spaces públicos ativos + os que eu participo, com minha situação e contagem de membros ativos. */
export async function listSpaces(userId: string): Promise<DiscoverSpace[]> {
  const admin = createAdminClient()
  const { data: spaceRows } = await admin.from('spaces').select('*').eq('is_active', true).order('created_at', { ascending: true })
  const spaces = (spaceRows ?? []) as Space[]
  const { data: memRows } = await admin.from('space_members').select('space_id, user_id, status')
  const mem = (memRows ?? []) as Array<{ space_id: string; user_id: string; status: string }>
  const activeBySpace = new Map<string, number>()
  const myStatusBySpace = new Map<string, string>()
  for (const m of mem) {
    if (m.status === 'active') activeBySpace.set(m.space_id, (activeBySpace.get(m.space_id) ?? 0) + 1)
    if (m.user_id === userId) myStatusBySpace.set(m.space_id, m.status)
  }
  return spaces
    .filter((s) => s.visibility === 'public' || myStatusBySpace.has(s.id))
    .map((s) => ({ ...s, members: activeBySpace.get(s.id) ?? 0, myStatus: myStatusBySpace.get(s.id) ?? null }))
}

export type SpaceLeaderRow = { rank: number; name: string; coins: number; isMe: boolean }

/**
 * Ranking da comunidade: membros ativos ordenados por MedCoins (consultas
 * finalizadas + ledger medcoin_events) — mesma moeda do ranking global.
 * Respeita o opt-in de nome (quem não optou aparece como "Anônimo").
 */
export async function spaceLeaderboard(spaceId: string, currentUserId: string, ownerId: string, topN = 20): Promise<{ top: SpaceLeaderRow[]; me: SpaceLeaderRow | null }> {
  const admin = createAdminClient()
  const { data: memRows } = await admin.from('space_members').select('user_id').eq('space_id', spaceId).eq('status', 'active')
  // Exclui o DONO da plataforma (staff) — não compete no ranking da liga.
  const ids = ((memRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id).filter((id) => id !== ownerId)
  if (ids.length === 0) return { top: [], me: null }

  const [consRes, ledgerRes, profRes] = await Promise.all([
    admin.from('consultations').select('user_id, points').eq('status', 'finished').gt('points', 0).in('user_id', ids),
    admin.from('medcoin_events').select('user_id, points').in('user_id', ids),
    admin.from('profiles').select('id, full_name, leaderboard_optin, leaderboard_alias').in('id', ids),
  ])
  const coins = new Map<string, number>()
  for (const r of ([...(consRes.data ?? []), ...(ledgerRes.data ?? [])] as Array<{ user_id: string; points: number | null }>)) {
    const p = r.points ?? 0
    if (p > 0) coins.set(r.user_id, (coins.get(r.user_id) ?? 0) + p)
  }
  const prof = new Map(((profRes.data ?? []) as Array<{ id: string; full_name: string | null; leaderboard_optin: boolean | null; leaderboard_alias: string | null }>).map((p) => [p.id, p]))
  const nameOf = (uid: string) => {
    const p = prof.get(uid)
    if (p?.leaderboard_optin) return p.leaderboard_alias?.trim() || p.full_name?.trim() || 'Aluno'
    return 'Anônimo'
  }
  const ranked = [...coins.entries()].map(([uid, c]) => ({ uid, c })).sort((a, b) => b.c - a.c)
  const top = ranked.slice(0, topN).map((r, i) => ({ rank: i + 1, name: r.uid === currentUserId ? 'Você' : nameOf(r.uid), coins: r.c, isMe: r.uid === currentUserId }))
  const myIdx = ranked.findIndex((r) => r.uid === currentUserId)
  const me = myIdx >= 0 ? { rank: myIdx + 1, name: 'Você', coins: ranked[myIdx].c, isMe: true } : null
  return { top, me }
}

export type SpaceChallengeRow = { rank: number; name: string; correct: number; coins: number; isMe: boolean }
export type SpaceChallenge = {
  active: boolean
  daysReleased: number
  weekTotal: number
  members: SpaceChallengeRow[]
  spaceCorrect: number     // soma de acertos da liga na semana (score p/ Arena)
  possible: number         // membros × dias liberados
  participants: number
}

/**
 * Desafio da Semana visto pela ótica do Space: placar dos membros (acertos +
 * MedCoins do desafio) na semana atual + agregado da liga. Reaproveita o desafio
 * global (challenge_days do weekly_case mais recente). Exclui o dono (staff).
 */
export async function spaceChallenge(spaceId: string, ownerId: string, currentUserId: string, nowMs: number): Promise<SpaceChallenge> {
  const admin = createAdminClient()
  const WEEK_TOTAL = 7
  const empty: SpaceChallenge = { active: false, daysReleased: 0, weekTotal: WEEK_TOTAL, members: [], spaceCorrect: 0, possible: 0, participants: 0 }

  const { data: memRows } = await admin.from('space_members').select('user_id').eq('space_id', spaceId).eq('status', 'active')
  const ids = ((memRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id).filter((id) => id !== ownerId)
  if (ids.length === 0) return empty

  const { data: wc } = await admin.from('weekly_cases').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle()
  const weekCaseId = (wc as { id?: string } | null)?.id
  if (!weekCaseId) return empty
  const today = new Date(nowMs).toISOString().slice(0, 10)
  const { data: dayRows } = await admin.from('challenge_days').select('quiz_id, reveal_date').eq('weekly_case_id', weekCaseId)
  const days = (dayRows ?? []) as Array<{ quiz_id: string; reveal_date: string }>
  const quizIds = new Set(days.map((d) => d.quiz_id))
  const daysReleased = days.filter((d) => d.reveal_date <= today).length
  if (quizIds.size === 0) return empty

  const [{ data: ans }, { data: profs }] = await Promise.all([
    admin.from('quiz_answers').select('user_id, is_correct, delta, quiz_id').in('user_id', ids),
    admin.from('profiles').select('id, full_name, leaderboard_optin, leaderboard_alias').in('id', ids),
  ])
  const correct = new Map<string, number>(), coins = new Map<string, number>()
  for (const a of ((ans ?? []) as Array<{ user_id: string; is_correct: boolean; delta: number | null; quiz_id: string }>)) {
    if (!quizIds.has(a.quiz_id)) continue
    if (a.is_correct) correct.set(a.user_id, (correct.get(a.user_id) ?? 0) + 1)
    coins.set(a.user_id, (coins.get(a.user_id) ?? 0) + (a.delta ?? 0))
  }
  const prof = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null; leaderboard_optin: boolean | null; leaderboard_alias: string | null }>).map((p) => [p.id, p]))
  const nameOf = (uid: string) => { const p = prof.get(uid); return p?.leaderboard_optin ? (p.leaderboard_alias?.trim() || p.full_name?.trim() || 'Aluno') : 'Anônimo' }

  const participants = new Set([...correct.keys(), ...[...coins.entries()].filter(([, c]) => c !== 0).map(([u]) => u)])
  const ranked = ids
    .map((uid) => ({ uid, c: correct.get(uid) ?? 0, k: coins.get(uid) ?? 0 }))
    .filter((r) => participants.has(r.uid))
    .sort((a, b) => b.c - a.c || b.k - a.k)
  const members = ranked.slice(0, 20).map((r, i) => ({ rank: i + 1, name: r.uid === currentUserId ? 'Você' : nameOf(r.uid), correct: r.c, coins: r.k, isMe: r.uid === currentUserId }))
  const spaceCorrect = [...correct.values()].reduce((s, n) => s + n, 0)

  return { active: true, daysReleased, weekTotal: WEEK_TOTAL, members, spaceCorrect, possible: ids.length * daysReleased, participants: participants.size }
}

export type SpacePost = {
  id: string; author_id: string; kind: string; body: string | null; created_at: string; author: string | null
  reactions: Record<string, number>; myEmoji: string | null; commentCount: number
}

/** Feed interno do space (posts escopados) com reações e contagem de comentários. */
export async function listSpacePosts(spaceId: string, currentUserId: string, limit = 30): Promise<SpacePost[]> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('posts')
    .select('id, author_id, kind, body, created_at')
    .eq('space_id', spaceId).is('hidden_at', null)
    .order('created_at', { ascending: false }).limit(limit)
  const base = (rows ?? []) as Array<{ id: string; author_id: string; kind: string; body: string | null; created_at: string }>
  if (base.length === 0) return []
  const ids = base.map((p) => p.id)

  const [{ data: profs }, { data: reacts }, { data: cmts }] = await Promise.all([
    admin.from('profiles').select('id, full_name').in('id', base.map((p) => p.author_id)),
    admin.from('post_reactions').select('post_id, user_id, emoji').in('post_id', ids),
    admin.from('comments').select('post_id').in('post_id', ids).is('hidden_at', null),
  ])
  const nameById = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]))
  const reByPost = new Map<string, { counts: Record<string, number>; mine: string | null }>()
  for (const r of ((reacts ?? []) as Array<{ post_id: string; user_id: string; emoji: string | null }>)) {
    const e = r.emoji ?? '👍'
    const cur = reByPost.get(r.post_id) ?? { counts: {}, mine: null }
    cur.counts[e] = (cur.counts[e] ?? 0) + 1
    if (r.user_id === currentUserId) cur.mine = e
    reByPost.set(r.post_id, cur)
  }
  const cmtCount = new Map<string, number>()
  for (const c of ((cmts ?? []) as Array<{ post_id: string }>)) cmtCount.set(c.post_id, (cmtCount.get(c.post_id) ?? 0) + 1)

  return base.map((p) => ({
    ...p,
    author: nameById.get(p.author_id) ?? null,
    reactions: reByPost.get(p.id)?.counts ?? {},
    myEmoji: reByPost.get(p.id)?.mine ?? null,
    commentCount: cmtCount.get(p.id) ?? 0,
  }))
}
