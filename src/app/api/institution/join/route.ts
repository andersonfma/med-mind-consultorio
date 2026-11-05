import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Vincula o aluno a uma instituição pelo código de convite da turma.
// POST { code }  → define profiles.institution_id. Code vazio desvincula.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await request.json().catch(() => ({})) as { code?: string }
  const code = (b.code ?? '').trim().toUpperCase()
  const admin = createAdminClient()

  if (!code) {
    await admin.from('profiles').update({ institution_id: null } as never).eq('id', user.id)
    return NextResponse.json({ ok: true, institution: null }, { status: 200 })
  }

  const { data: inst } = await admin.from('institutions').select('id, name').eq('invite_code', code).maybeSingle()
  const institution = inst as { id: string; name: string } | null
  if (!institution) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })

  await admin.from('profiles').update({ institution_id: institution.id } as never).eq('id', user.id)
  return NextResponse.json({ ok: true, institution: { name: institution.name } }, { status: 200 })
}
