import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { followerId?: unknown; accept?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const followerId = typeof body.followerId === 'string' ? body.followerId : ''
  if (!followerId) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const admin = createAdminClient()
  // o caller É o followee (dono do perfil); escopo garante que só aprova solicitações a si
  if (body.accept === true) {
    await admin.from('follows').update({ status: 'accepted' } as never)
      .eq('follower_id', followerId).eq('followee_id', user.id)
  } else {
    await admin.from('follows').delete().eq('follower_id', followerId).eq('followee_id', user.id)
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
