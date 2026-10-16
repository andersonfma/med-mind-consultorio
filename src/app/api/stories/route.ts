import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; mediaUrl?: unknown; consultationId?: unknown; caption?: unknown; captionX?: unknown; captionY?: unknown; captionScale?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const clamp01 = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1 ? v : null
  const kind = body.kind === 'image' || body.kind === 'video' || body.kind === 'card' ? body.kind : null
  if (!kind) return NextResponse.json({ error: 'kind inválido' }, { status: 422 })
  const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.slice(0, 1000) : null
  const consultationId = typeof body.consultationId === 'string' ? body.consultationId : null
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 200) || null : null

  if ((kind === 'image' || kind === 'video') && !mediaUrl) return NextResponse.json({ error: 'Mídia obrigatória' }, { status: 422 })
  if (kind === 'card' && !consultationId) return NextResponse.json({ error: 'Consulta obrigatória' }, { status: 422 })

  if (kind === 'card' && consultationId) {
    const { data: c } = await supabase.from('consultations').select('id, status').eq('id', consultationId).eq('user_id', user.id).single()
    const row = c as { id?: string; status?: string } | null
    if (!row?.id || row.status !== 'finished') return NextResponse.json({ error: 'Consulta inválida' }, { status: 403 })
  }

  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.from('stories').insert({
    author_id: user.id, kind, media_url: (kind === 'image' || kind === 'video') ? mediaUrl : null,
    consultation_id: kind === 'card' ? consultationId : null, caption,
    caption_x: caption ? clamp01(body.captionX) : null, caption_y: caption ? clamp01(body.captionY) : null,
    caption_scale: caption && typeof body.captionScale === 'number' ? Math.min(3, Math.max(0.5, body.captionScale)) : null,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Falha ao publicar story' }, { status: 500 })
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
