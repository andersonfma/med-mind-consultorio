import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { generateAndPersistForWeek, thisMonday } from '@/lib/challenge/generate'

export const dynamic = 'force-dynamic'

// Botão do admin: semeia o caso da SEMANA CORRENTE (pra validar hoje). O cron semanal
// cuida da próxima semana.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const r = await generateAndPersistForWeek(admin, thisMonday(new Date()))
  if (r.status === 'skipped') return NextResponse.json({ skipped: true, weekStart: r.weekStart }, { status: 200 })
  if (r.status === 'genfail') return NextResponse.json({ error: 'generation failed' }, { status: 502 })
  if (r.status === 'persistfail') return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  return NextResponse.json({ created: true, weekStart: r.weekStart }, { status: 201 })
}
