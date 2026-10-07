import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { suggestHandle } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { EditProfileForm } from './EditProfileForm'

export const dynamic = 'force-dynamic'

export default async function EditProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name').eq('id', user.id).single()
  const p = data as ProfileSocial
  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink">Editar perfil</h1>
      <EditProfileForm
        initial={{
          identity_mode: p.identity_mode, handle: p.handle ?? suggestHandle(user.email ?? 'aluno@medmind'),
          display_name: p.display_name ?? '', bio: p.bio ?? '', is_private: p.is_private, avatar_url: p.avatar_url,
        }}
      />
    </div>
  )
}
