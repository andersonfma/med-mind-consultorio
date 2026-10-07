import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidHandle } from '@/lib/social/identity'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.identity_mode === 'real' || body.identity_mode === 'alias') patch.identity_mode = body.identity_mode
  if (typeof body.display_name === 'string') patch.display_name = body.display_name.trim().slice(0, 80) || null
  if (typeof body.bio === 'string') patch.bio = body.bio.trim().slice(0, 280) || null
  if (typeof body.is_private === 'boolean') patch.is_private = body.is_private
  if (typeof body.handle === 'string') {
    const h = body.handle.trim().toLowerCase()
    if (!isValidHandle(h)) return NextResponse.json({ error: 'Invalid handle' }, { status: 422 })
    patch.handle = h
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update(patch as never).eq('id', user.id)
  if (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Handle em uso' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
