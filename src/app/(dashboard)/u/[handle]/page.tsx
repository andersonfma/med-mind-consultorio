import { notFound, redirect } from 'next/navigation'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE, postRoute, shareCardRoute } from '@/lib/routes'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { FollowButton } from './FollowButton'
import { ProfileActions } from './ProfileActions'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles')
    .select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name')
    .eq('handle', handle).single()
  const profile = prof as ProfileSocial | null
  if (!profile) notFound()

  const id = displayIdentity(profile)
  const isSelf = profile.id === user.id

  const [{ count: followers }, { count: following }, { data: myFollow }] = await Promise.all([
    admin.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', profile.id).eq('status', 'accepted'),
    admin.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id).eq('status', 'accepted'),
    admin.from('follows').select('status').eq('follower_id', user.id).eq('followee_id', profile.id).maybeSingle(),
  ])
  const followState = (myFollow as { status?: string } | null)?.status ?? 'none'

  // posts visíveis do autor (RLS filtra para o viewer)
  const { data: posts } = await db.from('posts').select('id, kind, consultation_id, body, created_at').eq('author_id', profile.id).order('created_at', { ascending: false }).limit(30)

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-surface-2 text-2xl font-bold text-ink">
          {id.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={id.avatarUrl} alt="" className="h-full w-full object-cover" /> : id.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-ink">{id.name}</h1>
          {profile.handle && <p className="text-sm text-muted">@{profile.handle}</p>}
          {profile.bio && <p className="mt-1 text-sm text-ink">{profile.bio}</p>}
          <p className="mt-1 text-xs text-muted tabular-nums">{followers ?? 0} seguidores · {following ?? 0} seguindo</p>
        </div>
        {!isSelf && (
          <div className="flex items-center gap-2">
            <FollowButton followeeId={profile.id} initialState={followState as 'none' | 'pending' | 'accepted'} isPrivate={profile.is_private} />
            <ProfileActions blockedId={profile.id} />
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {((posts ?? []) as Array<{ id: string; kind: string; consultation_id: string | null }>).map(p => (
          <a key={p.id} href={postRoute(p.id)} className="block aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
            {p.kind === 'card' && p.consultation_id
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={shareCardRoute(p.consultation_id)} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center p-2 text-center text-xs text-muted">texto</span>}
          </a>
        ))}
      </div>
    </div>
  )
}
