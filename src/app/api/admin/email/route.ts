import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { sendEmail } from '@/lib/email/send'
import { makeUnsubToken } from '@/lib/email/unsubscribe'
import { explainerEmail, APP_URL } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const unsubUrl = (userId: string) => `${APP_URL}/api/email/unsubscribe?token=${makeUnsubToken(userId)}`

// POST { mode: 'test' | 'broadcast' } — envia o email explicativo. Só admin.
//  test      → só para o próprio admin (preview no inbox).
//  broadcast → todos os usuários com email e sem opt-out.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { mode?: string }
  const admin = createAdminClient()

  if (body.mode === 'test') {
    if (!user.email) return NextResponse.json({ error: 'Admin sem email' }, { status: 400 })
    const { data: prof } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    const name = (prof as { full_name?: string } | null)?.full_name ?? ''
    const { subject, html } = explainerEmail({ name, unsubUrl: unsubUrl(user.id) })
    const r = await sendEmail({ to: user.email, subject, html, listUnsubscribe: unsubUrl(user.id) })
    return NextResponse.json(r, { status: r.ok ? 200 : 502 })
  }

  if (body.mode === 'broadcast') {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const users = (list?.users ?? []) as Array<{ id: string; email?: string }>
    const { data: profs } = await admin.from('profiles').select('id, full_name, email_optout')
    const byId = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null; email_optout: boolean | null }>).map(p => [p.id, p]))

    const targets = users.filter(u => u.email && !byId.get(u.id)?.email_optout)
    let sent = 0, failed = 0
    for (const u of targets) {
      const name = byId.get(u.id)?.full_name ?? ''
      const { subject, html } = explainerEmail({ name, unsubUrl: unsubUrl(u.id) })
      const r = await sendEmail({ to: u.email as string, subject, html, listUnsubscribe: unsubUrl(u.id) })
      if (r.ok) sent++; else failed++
    }
    return NextResponse.json({ sent, failed, skipped: users.length - targets.length, total: users.length }, { status: 200 })
  }

  return NextResponse.json({ error: 'mode inválido' }, { status: 400 })
}
