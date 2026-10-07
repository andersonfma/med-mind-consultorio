import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { RequestRow } from './RequestRow'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const admin = createAdminClient()
  const { data: reqs } = await admin.from('follows').select('follower_id').eq('followee_id', user.id).eq('status', 'pending')
  const ids = (reqs as Array<{ follower_id: string }> ?? []).map(r => r.follower_id)
  const { data: profs } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', ids.length ? ids : ['_'])
  const list = (profs as ProfileSocial[] ?? []).map(p => ({ id: p.id, name: displayIdentity(p).name }))

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink">Solicitações</h1>
      {list.length === 0 ? <p className="text-sm text-muted">Nenhuma solicitação pendente.</p> : list.map(r => <RequestRow key={r.id} followerId={r.id} name={r.name} />)}
    </div>
  )
}
