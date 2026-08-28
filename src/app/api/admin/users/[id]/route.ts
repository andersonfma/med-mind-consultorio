import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'

// PATCH { action: 'block' | 'unblock' } — bloqueia/desbloqueia um usuário via
// ban do Supabase (impede login e renovação de sessão). Só admin.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const action = (body as Record<string, unknown>)?.action
  if (action !== 'block' && action !== 'unblock')
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  const { id } = await params
  if (id === user.id)
    return NextResponse.json({ error: 'Você não pode bloquear a si mesmo' }, { status: 400 })

  const admin = createAdminClient()
  // '876000h' ≈ 100 anos (bloqueio efetivo); 'none' remove o ban.
  const ban_duration = action === 'block' ? '876000h' : 'none'
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration } as { ban_duration: string })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, blocked: action === 'block' })
}
