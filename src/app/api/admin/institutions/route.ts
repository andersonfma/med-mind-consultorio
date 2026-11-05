import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'

export const dynamic = 'force-dynamic'

// Código de convite legível (sem 0/O/1/I para evitar confusão).
function genCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]
  return s
}

// POST { name } → cria uma instituição com código de convite. Só dono.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await request.json().catch(() => ({})) as { name?: string }
  const name = (b.name ?? '').trim().slice(0, 120)
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  // tenta até achar um código único
  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = genCode()
    const { data, error } = await admin.from('institutions').insert({ name, invite_code } as never).select('id, name, invite_code').maybeSingle()
    if (!error && data) return NextResponse.json({ ok: true, institution: data }, { status: 200 })
    if (error && (error as { code?: string }).code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Não foi possível gerar código' }, { status: 500 })
}
