import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

async function who() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { db: supabase as unknown as SupabaseClient, user }
}

export async function POST(request: NextRequest) {
  const { db, user } = await who()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { blockedId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const blockedId = typeof body.blockedId === 'string' ? body.blockedId : ''
  if (!blockedId || blockedId === user.id) return NextResponse.json({ error: 'Alvo inválido' }, { status: 400 })
  const { error } = await db.from('blocks').upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' })
  if (error) return NextResponse.json({ error: 'Falha' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const { db, user } = await who()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { blockedId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const blockedId = typeof body.blockedId === 'string' ? body.blockedId : ''
  if (!blockedId) return NextResponse.json({ error: 'Alvo inválido' }, { status: 400 })
  await db.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
  return NextResponse.json({ ok: true }, { status: 200 })
}
