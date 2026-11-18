import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/social/push'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; consultationId?: unknown; rankingSnapshot?: unknown; body?: unknown; imageUrl?: unknown; meta?: unknown; spaceId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const KINDS = ['card', 'text', 'duvida', 'resenha', 'media'] as const
  const kind = (KINDS as readonly string[]).includes(body.kind as string) ? (body.kind as string) : null
  if (!kind) return NextResponse.json({ error: 'kind inválido' }, { status: 422 })
  const caption = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : ''
  const consultationId = typeof body.consultationId === 'string' ? body.consultationId : null
  const rankingSnapshot = body.rankingSnapshot && typeof body.rankingSnapshot === 'object' ? body.rankingSnapshot : null
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.slice(0, 1000) : null
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : null

  if ((kind === 'text' || kind === 'duvida' || kind === 'resenha') && !caption) {
    return NextResponse.json({ error: 'Texto vazio' }, { status: 422 })
  }
  if (kind === 'media' && !imageUrl) return NextResponse.json({ error: 'Mídia obrigatória' }, { status: 422 })
  if (kind === 'card' && !consultationId && !rankingSnapshot) return NextResponse.json({ error: 'Card sem referência' }, { status: 422 })

  if (kind === 'card' && consultationId) {
    const { data: c } = await supabase.from('consultations').select('id, status').eq('id', consultationId).eq('user_id', user.id).single()
    const row = c as { id?: string; status?: string } | null
    if (!row?.id || row.status !== 'finished') return NextResponse.json({ error: 'Consulta inválida' }, { status: 403 })
  }

  // Post dentro de um space: exige ser membro ativo.
  const spaceId = typeof body.spaceId === 'string' ? body.spaceId : null
  let adminPostSpace: { id: string; name: string } | null = null
  if (spaceId) {
    // space_members tem RLS sem policy (só service role lê). Checa com o admin client.
    const sadmin = createAdminClient()
    const [{ data: m }, { data: sp }] = await Promise.all([
      sadmin.from('space_members').select('status, role').eq('space_id', spaceId).eq('user_id', user.id).maybeSingle(),
      sadmin.from('spaces').select('owner_id, name').eq('id', spaceId).maybeSingle(),
    ])
    const mem = m as { status?: string; role?: string } | null
    const spaceRow = sp as { owner_id?: string; name?: string } | null
    const isMember = mem?.status === 'active'
    const isOwner = spaceRow?.owner_id === user.id
    if (!isMember && !isOwner) {
      return NextResponse.json({ error: 'Você não é membro deste space' }, { status: 403 })
    }
    // Aviso do Admin: post do dono/admin dispara push aos membros ativos.
    if ((isOwner || mem?.role === 'admin') && spaceRow?.name) adminPostSpace = { id: spaceId, name: spaceRow.name }
  }

  const insertRow = {
    author_id: user.id,
    kind,
    consultation_id: kind === 'card' ? consultationId : null,
    ranking_snapshot: kind === 'card' ? rankingSnapshot : null,
    body: caption || null,
    image_url: (kind === 'resenha' || kind === 'media') ? imageUrl : null,
    meta: (kind === 'resenha' || kind === 'media') ? meta : null,
    space_id: spaceId,
  }
  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.from('posts').insert(insertRow).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Falha ao publicar' }, { status: 500 })

  // Push de aviso do Admin para os membros ativos do space (menos o próprio autor).
  if (adminPostSpace) {
    const sadmin = createAdminClient()
    const { data: subs } = await sadmin.from('space_members').select('user_id').eq('space_id', adminPostSpace.id).eq('status', 'active')
    const targets = [...new Set(((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id))].filter((u) => u !== user.id)
    const preview = caption ? caption.slice(0, 80) : 'Novo aviso'
    await Promise.all(targets.map((u) => sendPush(sadmin as unknown as SupabaseClient, u, {
      title: `Admin · ${adminPostSpace!.name}`, body: preview, url: `/spaces`, tag: `space-${adminPostSpace!.id}`,
    }))).catch(() => {})
  }

  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
