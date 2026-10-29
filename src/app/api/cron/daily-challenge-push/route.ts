import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/social/push'

export const dynamic = 'force-dynamic'

const STAGE_LABEL: Record<string, string> = {
  anamnese: 'Anamnese', exame: 'Exame físico', complementares: 'Exames complementares',
  sintese: 'Síntese diagnóstica', conduta: 'Conduta', complicacoes: 'Complicações', conclusao: 'Conclusão',
}

// Push diário do desafio: avisa os inscritos quando o quiz do dia abre (seg→sex).
// Só notifica quem AINDA não respondeu o quiz de hoje. Disparado pela Action desafio-push.yml.
export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const admin = createAdminClient() as unknown as SupabaseClient
  const today = new Date().toISOString().slice(0, 10)

  // Dia revelado hoje (um por data; fim de semana não tem).
  const { data: dayRow } = await admin
    .from('challenge_days')
    .select('stage, quiz_id')
    .eq('reveal_date', today)
    .maybeSingle()
  const day = dayRow as { stage: string; quiz_id: string } | null
  if (!day) return NextResponse.json({ skipped: 'no challenge today', today }, { status: 200 })

  // Inscritos (distintos) e quem já respondeu o quiz de hoje.
  const [{ data: subs }, { data: answered }] = await Promise.all([
    admin.from('push_subscriptions').select('user_id'),
    admin.from('quiz_answers').select('user_id').eq('quiz_id', day.quiz_id),
  ])
  const subscribers = [...new Set(((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id))]
  const done = new Set(((answered ?? []) as Array<{ user_id: string }>).map((a) => a.user_id))
  const targets = subscribers.filter((u) => !done.has(u))

  const title = '🎯 Desafio de hoje'
  const body = `${STAGE_LABEL[day.stage] ?? day.stage} — responda e aposte seus MedCoins`
  await Promise.all(targets.map((u) => sendPush(admin, u, { title, body, url: '/desafio', tag: 'challenge' })))

  return NextResponse.json({ sent: targets.length, subscribers: subscribers.length, today }, { status: 200 })
}
