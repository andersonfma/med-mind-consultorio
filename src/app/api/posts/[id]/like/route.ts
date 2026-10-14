import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/social/notify'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabase as unknown as SupabaseClient
  const { error } = await db.from('post_reactions').upsert({ post_id: id, user_id: user.id }, { onConflict: 'post_id,user_id' })
  if (error) return NextResponse.json({ error: 'Não foi possível curtir' }, { status: 403 })

  // notifica o autor do post (best-effort)
  try {
    const admin = createAdminClient()
    const { data: p } = await admin.from('posts').select('author_id').eq('id', id).maybeSingle()
    const author = (p as { author_id?: string } | null)?.author_id
    if (author) await notify(admin, { userId: author, actorId: user.id, type: 'like', postId: id })
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabase as unknown as SupabaseClient
  await db.from('post_reactions').delete().eq('post_id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true }, { status: 200 })
}
