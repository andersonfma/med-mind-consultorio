import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — cria um space (RPC exige premium). Body: { name, slug, description?, institutionId?, joinPolicy?, visibility? }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await request.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : ''
  const slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) : ''
  if (!name || !slug) return NextResponse.json({ error: 'Nome e identificador são obrigatórios' }, { status: 422 })

  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.rpc('create_space', {
    p_name: name,
    p_slug: slug,
    p_description: typeof b.description === 'string' ? b.description.trim().slice(0, 300) : null,
    p_institution_id: typeof b.institutionId === 'string' ? b.institutionId : null,
    p_join_policy: b.joinPolicy === 'open' || b.joinPolicy === 'invite' ? b.joinPolicy : 'request',
    p_visibility: b.visibility === 'private' ? 'private' : 'public',
  })
  if (error) return NextResponse.json({ error: 'Falha ao criar' }, { status: 500 })
  const res = data as { ok?: boolean; error?: string; slug?: string }
  if (!res?.ok) {
    const msg = res?.error === 'premium_required' ? 'Criar um space é exclusivo do Premium.'
      : res?.error === 'slug_taken' ? 'Esse identificador já existe.' : 'Não foi possível criar.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true, slug: res.slug }, { status: 201 })
}
