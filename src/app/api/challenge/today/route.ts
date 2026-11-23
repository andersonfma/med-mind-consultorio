import { NextResponse } from 'next/server'
import { todayBR } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getChallengeToday } from '@/lib/challenge/today'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return todayBR()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const data = await getChallengeToday(admin, user.id, todayISO())
  return NextResponse.json(data, { status: 200 })
}
