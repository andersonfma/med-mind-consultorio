import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; consultationId?: unknown; rankingSnapshot?: unknown; body?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const kind = body.kind === 'card' || body.kind === 'text' ? body.kind : null
  if (!kind) return NextResponse.json({ error: 'kind inválido' }, { status: 422 })
  const caption = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : ''
  const consultationId = typeof body.consultationId === 'string' ? body.consultationId : null
  const rankingSnapshot = body.rankingSnapshot && typeof body.rankingSnapshot === 'object' ? body.rankingSnapshot : null

  if (kind === 'text' && !caption) return NextResponse.json({ error: 'Texto vazio' }, { status: 422 })
  if (kind === 'card' && !consultationId && !rankingSnapshot) return NextResponse.json({ error: 'Card sem referência' }, { status: 422 })

  if (kind === 'card' && consultationId) {
    const { data: c } = await supabase.from('consultations').select('id, status').eq('id', consultationId).eq('user_id', user.id).single()
    const row = c as { id?: string; status?: string } | null
    if (!row?.id || row.status !== 'finished') return NextResponse.json({ error: 'Consulta inválida' }, { status: 403 })
  }

  const insertRow = {
    author_id: user.id,
    kind,
    consultation_id: kind === 'card' ? consultationId : null,
    ranking_snapshot: kind === 'card' ? rankingSnapshot : null,
    body: caption || null,
  }
  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.from('posts').insert(insertRow).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Falha ao publicar' }, { status: 500 })
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
