import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function caller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await caller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { followeeId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const followeeId = typeof body.followeeId === 'string' ? body.followeeId : ''
  if (!followeeId || followeeId === user.id) return NextResponse.json({ error: 'Invalid followee' }, { status: 400 })

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('is_private').eq('id', followeeId).single()
  const isPrivate = (prof as { is_private?: boolean } | null)?.is_private === true
  const status = isPrivate ? 'pending' : 'accepted'
  const { error } = await admin.from('follows').upsert(
    { follower_id: user.id, followee_id: followeeId, status } as never,
    { onConflict: 'follower_id,followee_id' } as never,
  )
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ status }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const user = await caller()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { followeeId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const followeeId = typeof body.followeeId === 'string' ? body.followeeId : ''
  if (!followeeId) return NextResponse.json({ error: 'Invalid followee' }, { status: 400 })
  const admin = createAdminClient()
  await admin.from('follows').delete().eq('follower_id', user.id).eq('followee_id', followeeId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
