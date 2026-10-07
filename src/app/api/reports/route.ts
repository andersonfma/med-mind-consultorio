import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { targetType?: unknown; targetId?: unknown; reason?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const targetType = body.targetType === 'post' || body.targetType === 'comment' ? body.targetType : null
  const targetId = typeof body.targetId === 'string' ? body.targetId : ''
  if (!targetType || !targetId) return NextResponse.json({ error: 'Alvo inválido' }, { status: 422 })
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null
  const db = supabase as unknown as SupabaseClient
  const { error } = await db.from('reports').insert({ target_type: targetType, target_id: targetId, reporter_id: user.id, reason })
  if (error) return NextResponse.json({ error: 'Falha ao denunciar' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
