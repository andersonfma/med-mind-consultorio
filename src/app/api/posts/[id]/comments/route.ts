import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOUBT_REWARD, DOUBT_WINDOW_MIN } from '@/lib/economy'

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

  // Recompensa de MedCoin: 1º a responder uma DÚVIDA (≠ autor) em ≤30min. Best-effort.
  try {
    const admin = createAdminClient()
    const { data: postRow } = await admin.from('posts').select('kind, author_id, created_at').eq('id', id).maybeSingle()
    const post = postRow as { kind?: string; author_id?: string; created_at?: string } | null
    if (post?.kind === 'duvida' && post.author_id && post.author_id !== user.id && post.created_at) {
      const ageMin = (Date.now() - Date.parse(post.created_at)) / 60000
      if (ageMin <= DOUBT_WINDOW_MIN) {
        const { data: already } = await admin.from('medcoin_events').select('id').eq('ref_id', id).eq('source', 'doubt_answer').maybeSingle()
        if (!already) {
          // o índice único medcoin_doubt_once(ref_id) garante 1× mesmo em corrida
          await admin.from('medcoin_events').insert({ user_id: user.id, points: DOUBT_REWARD, source: 'doubt_answer', ref_id: id })
        }
      }
    }
  } catch { /* best-effort — não quebra o comentário */ }

  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
