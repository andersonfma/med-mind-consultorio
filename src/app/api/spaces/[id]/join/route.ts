import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — pedir para entrar no space. 'open' entra na hora; senão fica pendente.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.rpc('request_join_space', { p_space: id })
  if (error) return NextResponse.json({ error: 'Falha' }, { status: 500 })
  const res = data as { ok?: boolean; error?: string; status?: string }
  if (!res?.ok) {
    const msg = res?.error === 'invite_only' ? 'Este space é só por convite.' : 'Não foi possível entrar.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true, status: res.status }, { status: 200 })
}
