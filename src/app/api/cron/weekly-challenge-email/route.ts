import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { makeUnsubToken } from '@/lib/email/unsubscribe'
import { weeklyChallengeEmail, APP_URL } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const unsubUrl = (userId: string) => `${APP_URL}/api/email/unsubscribe?token=${makeUnsubToken(userId)}`

// Email semanal do desafio (segunda de manhã). Avisa todos (sem opt-out) do novo Caso da Semana.
export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const admin = createAdminClient()
  const db = admin as unknown as SupabaseClient
  const today = new Date().toISOString().slice(0, 10)

  // Caso da semana vigente (o mais recente que já começou).
  const { data: wc } = await db.from('weekly_cases')
    .select('title, week_start')
    .lte('week_start', today)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  const caseTitle = (wc as { title?: string } | null)?.title
  if (!caseTitle) return NextResponse.json({ skipped: 'no weekly case', today }, { status: 200 })

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const users = (list?.users ?? []) as Array<{ id: string; email?: string }>
  const { data: profs } = await db.from('profiles').select('id, full_name, email_optout')
  const byId = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null; email_optout: boolean | null }>).map(p => [p.id, p]))

  const targets = users.filter(u => u.email && !byId.get(u.id)?.email_optout)
  let sent = 0, failed = 0
  for (const u of targets) {
    const name = byId.get(u.id)?.full_name ?? ''
    const { subject, html, text } = weeklyChallengeEmail({ name, caseTitle, unsubUrl: unsubUrl(u.id) })
    const r = await sendEmail({ to: u.email as string, subject, html, text, listUnsubscribe: unsubUrl(u.id) })
    if (r.ok) sent++; else failed++
  }
  return NextResponse.json({ sent, failed, skipped: users.length - targets.length, total: users.length, caseTitle }, { status: 200 })
}
