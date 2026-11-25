import { NextResponse, type NextRequest } from 'next/server'
import { todayBR, brHour } from '@/lib/datetime'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/social/push'

export const dynamic = 'force-dynamic'

// Lembrete de "sequência em risco" (noite). Para quem TEM streak >= 1 e ainda NÃO
// respondeu o quiz de hoje — retenção. Disparado pela Action desafio-streak.yml.
export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  // Trava anti-madrugada: o agendador do GitHub atrasa; só lembramos entre 8h e 21h BRT.
  const h = brHour()
  if (h < 8 || h >= 22) return NextResponse.json({ skipped: 'fora do horário', hour: h }, { status: 200 })

  const admin = createAdminClient() as unknown as SupabaseClient
  const today = todayBR()

  // Quiz revelado hoje; se não houver (entre casos), não há o que lembrar.
  const { data: dayRow } = await admin
    .from('challenge_days')
    .select('quiz_id')
    .eq('reveal_date', today)
    .maybeSingle()
  const day = dayRow as { quiz_id: string } | null
  if (!day) return NextResponse.json({ skipped: 'no challenge today', today }, { status: 200 })

  const [{ data: subs }, { data: answered }] = await Promise.all([
    admin.from('push_subscriptions').select('user_id'),
    admin.from('quiz_answers').select('user_id').eq('quiz_id', day.quiz_id),
  ])
  const subscribers = [...new Set(((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id))]
  const done = new Set(((answered ?? []) as Array<{ user_id: string }>).map((a) => a.user_id))
  const pending = subscribers.filter((u) => !done.has(u))
  if (pending.length === 0) return NextResponse.json({ sent: 0, today }, { status: 200 })

  // Só quem tem sequência ativa (>= 1) — é a ela que o lembrete dá sentido.
  const { data: profs } = await admin.from('profiles').select('id, challenge_streak').in('id', pending)
  const streakById = new Map(((profs ?? []) as Array<{ id: string; challenge_streak: number | null }>).map((p) => [p.id, p.challenge_streak ?? 0]))
  const targets = pending.filter((u) => (streakById.get(u) ?? 0) >= 1)

  await Promise.all(targets.map((u) => {
    const n = streakById.get(u) ?? 0
    return sendPush(admin, u, {
      title: `🔥 Sua sequência de ${n} ${n === 1 ? 'dia' : 'dias'} está em risco`,
      body: 'Responda o desafio de hoje antes da meia-noite para manter o streak.',
      url: '/desafio', tag: 'streak',
    })
  }))

  return NextResponse.json({ sent: targets.length, pending: pending.length, today }, { status: 200 })
}
