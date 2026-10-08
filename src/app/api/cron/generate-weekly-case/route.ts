import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndPersistNextWeek } from '@/lib/challenge/generate'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const admin = createAdminClient()
  const r = await generateAndPersistNextWeek(admin, new Date())
  if (r.status === 'skipped') return NextResponse.json({ skipped: true, week_start: r.weekStart }, { status: 200 })
  if (r.status === 'genfail') return NextResponse.json({ error: 'generation failed' }, { status: 502 })
  if (r.status === 'persistfail') return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  return NextResponse.json({ created: true, week_start: r.weekStart }, { status: 201 })
}
