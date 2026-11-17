import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { spaceInviteEmail, APP_URL } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// POST — convites do space (só admin, validado pela RPC generate_space_invite).
//  { action: 'link', regenerate? }  → gera/retorna o token do link reutilizável
//  { action: 'emails', emails: [] } → garante o token e envia o link por e-mail
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({})) as { action?: string; regenerate?: boolean; emails?: string[] }
  const db = supabase as unknown as SupabaseClient

  const { data: gen, error } = await db.rpc('generate_space_invite', { p_space: id, p_regenerate: !!b.regenerate })
  if (error) return NextResponse.json({ error: 'Falha' }, { status: 500 })
  const res = gen as { ok?: boolean; error?: string; token?: string }
  if (!res?.ok || !res.token) {
    return NextResponse.json({ error: res?.error === 'forbidden' ? 'Sem permissão.' : 'Não foi possível.' }, { status: 400 })
  }
  const token = res.token
  const link = `${APP_URL}/convite/${token}`

  if (b.action === 'emails') {
    const emails = Array.isArray(b.emails)
      ? [...new Set(b.emails.map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))].slice(0, 50)
      : []
    if (emails.length === 0) return NextResponse.json({ error: 'Nenhum e-mail válido.' }, { status: 422 })

    const admin = createAdminClient()
    const { data: sp } = await admin.from('spaces').select('name').eq('id', id).maybeSingle()
    const spaceName = (sp as { name?: string } | null)?.name ?? 'um Space'
    let sent = 0, failed = 0
    for (const to of emails) {
      const { subject, html, text } = spaceInviteEmail({ spaceName, link })
      const r = await sendEmail({ to, subject, html, text })
      if (r.ok) sent++; else failed++
    }
    return NextResponse.json({ ok: true, token, link, sent, failed }, { status: 200 })
  }

  return NextResponse.json({ ok: true, token, link }, { status: 200 })
}
