import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/** Apaga um post do próprio usuário (RLS posts_delete garante autoria). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabase as unknown as SupabaseClient
  const { error } = await db.from('posts').delete().eq('id', id).eq('author_id', user.id)
  if (error) return NextResponse.json({ error: 'Falha ao apagar' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
