import { NextResponse } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'

export const dynamic = 'force-dynamic'

type Row = { id: string; actor_id: string | null; type: string; post_id: string | null; read_at: string | null; created_at: string }

/** Lista as notificações do usuário (últimas 30) + contagem de não-lidas. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabase as unknown as SupabaseClient
  const { data: rows } = await db.from('notifications').select('id, actor_id, type, post_id, read_at, created_at').order('created_at', { ascending: false }).limit(30)
  const list = (rows ?? []) as Row[]

  const admin = createAdminClient()
  const actorIds = [...new Set(list.map(r => r.actor_id).filter(Boolean) as string[])]
  const { data: profs } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', actorIds.length ? actorIds : ['_'])
  const byId = new Map((profs as ProfileSocial[] ?? []).map(p => [p.id, p]))

  const items = list.map(r => {
    const p = r.actor_id ? byId.get(r.actor_id) : undefined
    const d = p ? displayIdentity(p) : { name: 'Alguém', avatarUrl: null, initials: '?' }
    return { id: r.id, type: r.type, postId: r.post_id, read: !!r.read_at, createdAt: r.created_at, actorName: d.name, actorInitials: d.initials, actorAvatar: d.avatarUrl, actorHandle: p?.handle ?? null }
  })
  const unread = list.filter(r => !r.read_at).length
  return NextResponse.json({ items, unread }, { status: 200 })
}

/** Marca todas as não-lidas como lidas. */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabase as unknown as SupabaseClient
  await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  return NextResponse.json({ ok: true }, { status: 200 })
}
