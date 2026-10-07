import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

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
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
