import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMedcoinBalance } from '@/lib/challenge/today'
import { resolveBet, nextStreak, streakFactor, dayFactor, type Stage } from '@/lib/economy'

export const dynamic = 'force-dynamic'

function todayISO(): string { return new Date().toISOString().slice(0, 10) }

export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { chosenKey?: unknown; stake?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const chosenKey = typeof body.chosenKey === 'string' ? body.chosenKey : ''
  const stake = typeof body.stake === 'number' ? body.stake : 0
  if (!chosenKey) return NextResponse.json({ error: 'chosenKey obrigatório' }, { status: 422 })

  const admin = createAdminClient()
  const today = todayISO()

  // o quiz pertence a um dia de desafio aberto HOJE?
  const { data: dayRow } = await admin.from('challenge_days').select('reveal_date, stage').eq('quiz_id', quizId).maybeSingle()
  const day = dayRow as { reveal_date: string; stage: Stage } | null
  if (!day) return NextResponse.json({ error: 'Quiz não é do desafio' }, { status: 404 })
  if (day.reveal_date !== today) return NextResponse.json({ error: 'Quiz fechado' }, { status: 403 })

  // já respondeu?
  const { data: prev } = await admin.from('quiz_answers').select('user_id').eq('quiz_id', quizId).eq('user_id', user.id).maybeSingle()
  if (prev) return NextResponse.json({ error: 'Já respondido' }, { status: 409 })

  // gabarito (service role — coluna protegida)
  const { data: quizRow } = await admin.from('quizzes').select('correct_key, explanation').eq('id', quizId).single()
  const quiz = quizRow as { correct_key: string; explanation: string | null } | null
  if (!quiz) return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 })
  const isCorrect = chosenKey === quiz.correct_key

  const balance = await getMedcoinBalance(admin, user.id)
  const { data: profRow } = await admin.from('profiles').select('challenge_streak, challenge_last_date').eq('id', user.id).maybeSingle()
  const prof = (profRow as { challenge_streak?: number; challenge_last_date?: string | null } | null) ?? {}
  const nStreak = nextStreak(prof.challenge_last_date ?? null, today, prof.challenge_streak ?? 0)
  const { delta, effStake } = resolveBet(stake, isCorrect, balance, dayFactor(day.stage), streakFactor(nStreak))

  await admin.from('quiz_answers').insert({ quiz_id: quizId, user_id: user.id, chosen_key: chosenKey, is_correct: isCorrect, stake: effStake, delta })
  if (delta !== 0) {
    await admin.from('medcoin_events').insert({ user_id: user.id, points: delta, source: 'challenge', ref_id: quizId })
  }
  await admin.from('profiles').update({ challenge_streak: nStreak, challenge_last_date: today }).eq('id', user.id)

  // % da rede (inclui esta resposta)
  const { data: allAns } = await admin.from('quiz_answers').select('is_correct').eq('quiz_id', quizId)
  const rows = (allAns as Array<{ is_correct: boolean }> ?? [])
  const networkPct = rows.length ? Math.round((rows.filter(r => r.is_correct).length / rows.length) * 100) : 0

  return NextResponse.json({
    isCorrect, correctKey: quiz.correct_key, explanation: quiz.explanation,
    networkPct, delta, newBalance: balance + delta, streak: nStreak,
  }, { status: 200 })
}
