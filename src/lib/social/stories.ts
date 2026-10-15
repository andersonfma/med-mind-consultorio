import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'
import { displayIdentity } from './identity'
import type { ProfileSocial } from './types'

export type StoryItem = { id: string; kind: 'image' | 'video' | 'card'; mediaUrl: string | null; consultationId: string | null; caption: string | null; createdAt: string }
export type StoryGroup = {
  author: { id: string; name: string; initials: string; avatarUrl: string | null; handle: string | null }
  isOwn: boolean
  stories: StoryItem[]
}

/**
 * Stories ativos (não expirados) visíveis ao usuário, agrupados por autor. A RLS já filtra
 * visibilidade/expiração via o client do usuário; nomes resolvidos via admin. O próprio vem 1º.
 */
export async function getActiveStories(userDb: SupabaseClient, admin: SupabaseClient, userId: string): Promise<StoryGroup[]> {
  const { data: rows } = await userDb.from('stories')
    .select('id, author_id, kind, media_url, consultation_id, caption, created_at')
    .order('created_at', { ascending: true })
  const stories = (rows ?? []) as Array<{ id: string; author_id: string; kind: 'image' | 'video' | 'card'; media_url: string | null; consultation_id: string | null; caption: string | null; created_at: string }>
  if (stories.length === 0) return []

  const authorIds = [...new Set(stories.map(s => s.author_id))]
  const { data: profs } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', authorIds)
  const byId = new Map((profs as ProfileSocial[] ?? []).map(p => [p.id, p]))

  const groups = new Map<string, StoryGroup>()
  for (const s of stories) {
    let g = groups.get(s.author_id)
    if (!g) {
      const p = byId.get(s.author_id)
      const d = p ? displayIdentity(p) : { name: 'Aluno', avatarUrl: null, initials: 'A' }
      g = { author: { id: s.author_id, name: d.name, initials: d.initials, avatarUrl: d.avatarUrl, handle: p?.handle ?? null }, isOwn: s.author_id === userId, stories: [] }
      groups.set(s.author_id, g)
    }
    g.stories.push({ id: s.id, kind: s.kind, mediaUrl: s.media_url, consultationId: s.consultation_id, caption: s.caption, createdAt: s.created_at })
  }

  const list = [...groups.values()]
  list.sort((a, b) => (a.isOwn === b.isOwn ? 0 : a.isOwn ? -1 : 1)) // o próprio primeiro
  return list
}
