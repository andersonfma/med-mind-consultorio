import { redirect } from 'next/navigation'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { buildFeedPosts } from '@/lib/social/feed'
import type { ProfileSocial } from '@/lib/social/types'
import { FeedList } from './FeedList'
import { NewPostComposer } from './NewPostComposer'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  // RLS (posts_select) já filtra visibilidade; buscamos os posts visíveis mais recentes.
  const { data: rawPosts } = await db.from('posts').select('*').order('created_at', { ascending: false }).limit(30)
  const posts = (rawPosts ?? []) as Array<{ id: string; author_id: string; kind: 'card' | 'text'; consultation_id: string | null; ranking_snapshot: unknown; body: string | null; created_at: string }>

  const admin = createAdminClient()
  const authorIds = [...new Set(posts.map(p => p.author_id))]
  const ids = posts.map(p => p.id)

  const [{ data: profs }, { data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
    admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name').in('id', authorIds.length ? authorIds : ['_']),
    admin.from('post_reactions').select('post_id').in('post_id', ids.length ? ids : ['_']),
    db.from('post_reactions').select('post_id').eq('user_id', user.id).in('post_id', ids.length ? ids : ['_']),
    admin.from('comments').select('post_id').is('hidden_at', null).in('post_id', ids.length ? ids : ['_']),
  ])

  const count = (rows: Array<{ post_id: string }> | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1)
    return m
  }
  const likeMap = count(likes as Array<{ post_id: string }> | null)
  const commentMap = count(comments as Array<{ post_id: string }> | null)
  const mine = new Set((myLikes as Array<{ post_id: string }> | null ?? []).map(r => r.post_id))

  const profilesById = new Map<string, ProfileSocial>((profs as ProfileSocial[] ?? []).map(p => [p.id, p]))
  const rows = posts.map(p => ({
    ...p,
    like_count: likeMap.get(p.id) ?? 0,
    comment_count: commentMap.get(p.id) ?? 0,
    liked_by_me: mine.has(p.id),
  }))
  const feed = buildFeedPosts(rows, profilesById, user.id)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Feed</h1>
      <NewPostComposer />
      <FeedList posts={feed} />
    </div>
  )
}
