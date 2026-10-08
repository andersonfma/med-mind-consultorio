import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'

export type ChallengeDayView = {
  dayIndex: number
  stage: string
  revealDate: string
  narrative: string
  quiz: { id: string; prompt: string; options: { key: string; text: string }[] }
  answered: { chosenKey: string; isCorrect: boolean } | null
  // gabarito só quando respondido OU dia fechado (revealDate < hoje)
  reveal: { correctKey: string; explanation: string | null } | null
}

export type ChallengeToday = {
  case: { id: string; title: string; weekStart: string; overview: string } | null
  days: ChallengeDayView[]
  todayDayIndex: number | null
  conclusion: { review: string; trueDiagnosis: string } | null
  balance: number
  streak: number
}

type Admin = SupabaseClient

/**
 * Monta o estado do desafio para `userId` em `today` (YYYY-MM-DD), usando o service role
 * (admin) — que lê colunas sensíveis — e decide o que revelar. Gabarito do dia corrente
 * NÃO é incluído até o usuário responder.
 */
export async function getChallengeToday(admin: Admin, userId: string, today: string): Promise<ChallengeToday> {
  const empty: ChallengeToday = { case: null, days: [], todayDayIndex: null, conclusion: null, balance: 0, streak: 0 }

  const balance = await getMedcoinBalance(admin, userId)
  const { data: profRow } = await admin.from('profiles').select('challenge_streak').eq('id', userId).maybeSingle()
  const streak = (profRow as { challenge_streak?: number } | null)?.challenge_streak ?? 0

  // caso da semana corrente = último com week_start <= hoje
  const { data: wcRow } = await admin.from('weekly_cases')
    .select('id, title, week_start, overview, review, true_diagnosis')
    .lte('week_start', today).order('week_start', { ascending: false }).limit(1).maybeSingle()
  const wc = wcRow as { id: string; title: string; week_start: string; overview: string; review: string; true_diagnosis: string } | null
  if (!wc) return { ...empty, balance, streak }

  const { data: dayRows } = await admin.from('challenge_days')
    .select('day_index, stage, reveal_date, narrative, quiz_id')
    .eq('weekly_case_id', wc.id).lte('reveal_date', today).order('day_index', { ascending: true })
  const days = (dayRows ?? []) as Array<{ day_index: number; stage: string; reveal_date: string; narrative: string; quiz_id: string }>
  if (days.length === 0) {
    return { case: { id: wc.id, title: wc.title, weekStart: wc.week_start, overview: wc.overview }, days: [], todayDayIndex: null, conclusion: null, balance, streak }
  }

  const quizIds = days.map(d => d.quiz_id)
  const [{ data: quizRows }, { data: ansRows }] = await Promise.all([
    admin.from('quizzes').select('id, prompt, options, correct_key, explanation').in('id', quizIds),
    admin.from('quiz_answers').select('quiz_id, chosen_key, is_correct').eq('user_id', userId).in('quiz_id', quizIds),
  ])
  const quizById = new Map((quizRows as Array<{ id: string; prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string | null }> ?? []).map(q => [q.id, q]))
  const ansByQuiz = new Map((ansRows as Array<{ quiz_id: string; chosen_key: string; is_correct: boolean }> ?? []).map(a => [a.quiz_id, a]))

  const views: ChallengeDayView[] = days.map(d => {
    const q = quizById.get(d.quiz_id)
    const ans = ansByQuiz.get(d.quiz_id) ?? null
    const closed = d.reveal_date < today // dia anterior já fechou
    const showReveal = !!ans || closed
    return {
      dayIndex: d.day_index,
      stage: d.stage,
      revealDate: d.reveal_date,
      narrative: d.narrative,
      quiz: { id: d.quiz_id, prompt: q?.prompt ?? '', options: q?.options ?? [] },
      answered: ans ? { chosenKey: ans.chosen_key, isCorrect: ans.is_correct } : null,
      reveal: showReveal && q ? { correctKey: q.correct_key, explanation: q.explanation } : null,
    }
  })

  const todayDay = days.find(d => d.reveal_date === today) ?? null
  const concDay = days.find(d => d.stage === 'conclusao') ?? null
  const concAns = concDay ? ansByQuiz.get(concDay.quiz_id) : null
  const concClosed = concDay ? concDay.reveal_date < today : false
  const conclusion = concDay && (concAns || concClosed) ? { review: wc.review, trueDiagnosis: wc.true_diagnosis } : null

  return {
    case: { id: wc.id, title: wc.title, weekStart: wc.week_start, overview: wc.overview },
    days: views,
    todayDayIndex: todayDay?.day_index ?? null,
    conclusion,
    balance,
    streak,
  }
}

/** Saldo de MedCoin = soma(consultations.points) + soma(medcoin_events.points). */
export async function getMedcoinBalance(admin: Admin, userId: string): Promise<number> {
  const [{ data: cons }, { data: ev }] = await Promise.all([
    admin.from('consultations').select('points').eq('user_id', userId),
    admin.from('medcoin_events').select('points').eq('user_id', userId),
  ])
  const sum = (rows: Array<{ points: number | null }> | null) => (rows ?? []).reduce((a, r) => a + (r.points ?? 0), 0)
  return sum(cons as Array<{ points: number | null }> | null) + sum(ev as Array<{ points: number | null }> | null)
}
