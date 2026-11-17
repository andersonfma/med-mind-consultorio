import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type Space = {
  id: string; slug: string; name: string; description: string | null
  owner_id: string; institution_id: string | null
  join_policy: 'request' | 'invite' | 'open'; visibility: 'public' | 'private'; is_active: boolean
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

export type SpacePost = { id: string; author_id: string; kind: string; body: string | null; created_at: string; author: string | null }

/** Feed interno do space (posts escopados). */
export async function listSpacePosts(spaceId: string, limit = 30): Promise<SpacePost[]> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('posts')
    .select('id, author_id, kind, body, created_at')
    .eq('space_id', spaceId).is('hidden_at', null)
    .order('created_at', { ascending: false }).limit(limit)
  const posts = (rows ?? []) as Array<Omit<SpacePost, 'author'>>
  if (posts.length === 0) return []
  const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', posts.map((p) => p.author_id))
  const nameById = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]))
  return posts.map((p) => ({ ...p, author: nameById.get(p.author_id) ?? null }))
}
