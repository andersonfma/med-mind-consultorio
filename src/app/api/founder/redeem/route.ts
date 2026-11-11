import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Resgata um código de fundador para o usuário autenticado (ex.: BJ2K29).
// A validação e a concessão de premium_until acontecem na RPC redeem_founder_code.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let code = ''
  try {
    const body = await request.json()
    code = String(body?.code ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (!code) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

  const db = supabase as unknown as SupabaseClient
  const { data, error } = await db.rpc('redeem_founder_code', { p_code: code })
  if (error) return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })

  const result = (data ?? {}) as { ok?: boolean; error?: string; premium_until?: string; days?: number; already?: boolean }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
