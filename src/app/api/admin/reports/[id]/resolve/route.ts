import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'

export const dynamic = 'force-dynamic'

/** Admin resolve uma denúncia; opcionalmente oculta o alvo (post/comment) via hidden_at. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { hide?: unknown }
  try { body = await request.json() } catch { body = {} }
  const hide = body.hide === true

  const admin = createAdminClient()
  const { data: rep } = await admin.from('reports').select('target_type, target_id').eq('id', id).maybeSingle()
  const report = rep as { target_type?: string; target_id?: string } | null
  if (!report?.target_id) return NextResponse.json({ error: 'Denúncia não encontrada' }, { status: 404 })

  if (hide && (report.target_type === 'post' || report.target_type === 'comment')) {
    const table = report.target_type === 'post' ? 'posts' : 'comments'
    await admin.from(table).update({ hidden_at: new Date().toISOString() }).eq('id', report.target_id)
  }
  await admin.from('reports').update({ status: 'resolved' }).eq('id', id)

  return NextResponse.json({ ok: true, hidden: hide }, { status: 200 })
}
