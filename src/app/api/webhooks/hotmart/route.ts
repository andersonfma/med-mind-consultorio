import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Períodos (dias) por plano — mapeados pela recorrência enviada pela Hotmart.
const MONTHLY_DAYS = 31
const ANNUAL_DAYS = 367

// Eventos que CONCEDEM acesso (aprovação/renovação) e que REVOGAM (reembolso/chargeback).
const GRANT = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SUBSCRIPTION_RENEWAL'])
const REVOKE = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_EXPIRED', 'PURCHASE_PROTEST'])
// Cancelamento NÃO revoga na hora — o aluno mantém acesso até premium_until (fim do período).

type HotmartBody = {
  event?: string
  data?: {
    buyer?: { email?: string }
    purchase?: {
      transaction?: string
      recurrence_number?: number
      subscription?: { plan?: { name?: string } }
      offer?: { code?: string }
    }
    subscription?: { plan?: { name?: string }; subscriber?: { email?: string } }
  }
}

function periodDays(body: HotmartBody): number {
  const plan = (body.data?.purchase?.subscription?.plan?.name
    ?? body.data?.subscription?.plan?.name ?? '').toLowerCase()
  if (/anual|annual|ano|year/.test(plan)) return ANNUAL_DAYS
  return MONTHLY_DAYS
}

export async function POST(request: NextRequest) {
  // Autenticação: a Hotmart envia o hottok da conta no header.
  const hottok = request.headers.get('x-hotmart-hottok')
  if (!process.env.HOTMART_HOTTOK || hottok !== process.env.HOTMART_HOTTOK) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: HotmartBody
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const event = body.event ?? ''
  const email = body.data?.buyer?.email ?? body.data?.subscription?.subscriber?.email ?? null
  const txn = body.data?.purchase?.transaction ?? null

  const admin = createAdminClient()

  // Idempotência: ignora reprocessamento da mesma transação+evento.
  const externalId = txn ? `${txn}:${event}` : null
  if (externalId) {
    const { data: seen } = await admin.from('payment_events').select('id').eq('provider', 'hotmart').eq('external_id', externalId).maybeSingle()
    if (seen) return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
  }

  // Casa o comprador pelo e-mail.
  let userId: string | null = null
  if (email) {
    const { data: uid } = await admin.rpc('user_id_by_email', { p_email: email })
    userId = (uid as string | null) ?? null
  }

  // Aplica o efeito no premium.
  if (userId) {
    if (GRANT.has(event)) {
      const until = new Date(Date.now() + periodDays(body) * 86_400_000).toISOString()
      await admin.from('profiles').update({ is_premium: true, premium_until: until } as never).eq('id', userId)
    } else if (REVOKE.has(event)) {
      await admin.from('profiles').update({ is_premium: false, premium_until: new Date().toISOString() } as never).eq('id', userId)
    }
    // SUBSCRIPTION_CANCELLATION: não faz nada — mantém até premium_until.
  }

  // Registra o evento (auditoria + idempotência).
  await admin.from('payment_events').insert({
    provider: 'hotmart', event, external_id: externalId, email, user_id: userId, payload: body as never,
  } as never)

  return NextResponse.json({ ok: true, matched: !!userId, event }, { status: 200 })
}
