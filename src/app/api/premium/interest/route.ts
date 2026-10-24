import { NextResponse } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Registra interesse no Premium (idempotente, 1 linha por usuário). Sem cobrança.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = supabase as unknown as SupabaseClient
  const { error } = await db
    .from('premium_interest')
    .upsert({ user_id: user.id } as never, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'Falha ao registrar' }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 200 })
}
