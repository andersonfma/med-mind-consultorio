import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'Inscrição inválida' }, { status: 422 })

  const db = supabase as unknown as SupabaseClient
  const { error } = await db.from('push_subscriptions').upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: 'Falha ao salvar' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { endpoint?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint) return NextResponse.json({ error: 'Inscrição inválida' }, { status: 422 })
  const db = supabase as unknown as SupabaseClient
  await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  return NextResponse.json({ ok: true }, { status: 200 })
}
