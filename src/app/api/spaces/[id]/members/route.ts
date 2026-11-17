import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — ações de admin sobre membros. Body: { action: 'approve'|'remove'|'role', userId, role? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({})) as { action?: string; userId?: string; role?: string }
  if (!b.userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 422 })

  let rpc: string, args: Record<string, unknown>
  if (b.action === 'approve') { rpc = 'approve_member'; args = { p_space: id, p_user: b.userId } }
  else if (b.action === 'remove') { rpc = 'remove_member'; args = { p_space: id, p_user: b.userId } }
  else if (b.action === 'role') { rpc = 'set_member_role'; args = { p_space: id, p_user: b.userId, p_role: b.role } }
  else return NextResponse.json({ error: 'ação inválida' }, { status: 422 })

  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.rpc(rpc, args)
  if (error) return NextResponse.json({ error: 'Falha' }, { status: 500 })
  const res = data as { ok?: boolean; error?: string }
  if (!res?.ok) {
    const msg = res?.error === 'forbidden' ? 'Sem permissão.'
      : res?.error === 'target_not_premium' ? 'Para virar admin, o membro precisa ser Premium.'
      : res?.error === 'cannot_remove_owner' ? 'O dono não pode ser removido.' : 'Não foi possível.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
