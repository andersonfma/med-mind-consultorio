import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOUBT_REWARD, DOUBT_WINDOW_MIN } from '@/lib/economy'
import { displayIdentity } from '@/lib/social/identity'
import { notify } from '@/lib/social/notify'
import type { ProfileSocial } from '@/lib/social/types'

export const dynamic = 'force-dynamic'

/** Lista comentários do post (RLS garante visibilidade); nomes resolvidos via admin. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabase as unknown as SupabaseClient
  const { data: rows } = await db.from('comments').select('id, author_id, body, created_at').eq('post_id', id).is('hidden_at', null).order('created_at', { ascending: true })
  const comments = (rows ?? []) as Array<{ id: string; author_id: string; body: string; created_at: string }>

  const admin = createAdminClient()
  const ids = [...new Set(comments.map(c => c.author_id))]
  const { data: profs } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', ids.length ? ids : ['_'])
  const byId = new Map((profs as ProfileSocial[] ?? []).map(p => [p.id, p]))

  const out = comments.map(c => {
    const p = byId.get(c.author_id)
    const d = p ? displayIdentity(p) : { name: 'Aluno', avatarUrl: null, initials: 'A' }
    return { id: c.id, name: d.name, initials: d.initials, avatarUrl: d.avatarUrl, body: c.body, createdAt: c.created_at }
  })
  return NextResponse.json({ comments: out }, { status: 200 })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { body?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : ''
  if (!text) return NextResponse.json({ error: 'Comentário vazio' }, { status: 422 })
  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.from('comments').insert({ post_id: id, author_id: user.id, body: text }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Não foi possível comentar' }, { status: 403 })

  // Notificação ao autor do post + recompensa de dúvida. Best-effort.
  try {
    const admin = createAdminClient()
    const { data: postRow } = await admin.from('posts').select('kind, author_id, created_at').eq('id', id).maybeSingle()
    const post = postRow as { kind?: string; author_id?: string; created_at?: string } | null
    if (post?.author_id) await notify(admin, { userId: post.author_id, actorId: user.id, type: 'comment', postId: id })

    if (post?.kind === 'duvida' && post.author_id && post.author_id !== user.id && post.created_at) {
      const ageMin = (Date.now() - Date.parse(post.created_at)) / 60000
      if (ageMin <= DOUBT_WINDOW_MIN) {
        const { data: already } = await admin.from('medcoin_events').select('id').eq('ref_id', id).eq('source', 'doubt_answer').maybeSingle()
        if (!already) {
          // o índice único medcoin_doubt_once(ref_id) garante 1× mesmo em corrida
          await admin.from('medcoin_events').insert({ user_id: user.id, points: DOUBT_REWARD, source: 'doubt_answer', ref_id: id })
          await notify(admin, { userId: user.id, actorId: post.author_id, type: 'doubt_answer', postId: id }) // avisa o respondedor do bônus
        }
      }
    }
  } catch { /* best-effort — não quebra o comentário */ }

  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
