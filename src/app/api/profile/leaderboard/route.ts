import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALIAS_MAX = 40

/**
 * Opt-in / opt-out do aluno no ranking público + apelido exibido.
 * Escrita feita com service role mas SEMPRE escopada ao próprio user.id
 * (o grant de UPDATE em profiles para o papel authenticated é restrito por coluna).
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { optin?: unknown; alias?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const optin = body.optin === true
  let alias: string | null = null
  if (typeof body.alias === 'string') {
    alias = body.alias.trim().slice(0, ALIAS_MAX) || null
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ leaderboard_optin: optin, leaderboard_alias: alias } as never)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ optin, alias }, { status: 200 })
}
