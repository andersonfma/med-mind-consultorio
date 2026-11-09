import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Desliga o premium pago vencido (premium_until no passado). Concessões permanentes
// (premium_until nulo) não são tocadas. Disparado pela Action expirar-premium.yml.
export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('expire_premium')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expired: (data as number) ?? 0 }, { status: 200 })
}
