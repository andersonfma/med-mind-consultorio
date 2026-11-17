import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'

export const dynamic = 'force-dynamic'

// PATCH { code, active } — liga/desliga um cupom de fundador. Só admin.
// Desligar NÃO revoga quem já resgatou (o Premium concedido continua até vencer);
// apenas impede novos resgates do código.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { code?: string; active?: boolean }
  if (!body.code || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'code e active são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const code = body.code.trim().toUpperCase()
  const { error } = await admin.from('founder_codes').update({ active: body.active } as never).eq('code', code)
  if (error) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 })
  return NextResponse.json({ ok: true, code, active: body.active }, { status: 200 })
}
