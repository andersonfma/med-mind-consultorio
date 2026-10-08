import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWeeklyCase } from '@/lib/challenge/generate'

export const dynamic = 'force-dynamic'

/** Segunda-feira da PRÓXIMA semana (UTC), YYYY-MM-DD. */
function nextMonday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay()
  const add = ((8 - dow) % 7) || 7
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const admin = createAdminClient()
  const weekStart = nextMonday(new Date())

  const { data: existing } = await admin.from('weekly_cases').select('id').eq('week_start', weekStart).maybeSingle()
  if (existing) return NextResponse.json({ skipped: true, week_start: weekStart }, { status: 200 })

  const week = await generateWeeklyCase()
  if (!week) return NextResponse.json({ error: 'generation failed' }, { status: 502 })

  const { data: wc, error: wcErr } = await admin.from('weekly_cases')
    .insert({ week_start: weekStart, specialty: 'Clínica Médica', title: week.title, true_diagnosis: week.true_diagnosis, overview: week.overview, review: week.review })
    .select('id').single()
  if (wcErr || !wc) return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  const caseId = (wc as { id: string }).id

  try {
    for (const d of week.days) {
      const { data: q, error: qErr } = await admin.from('quizzes')
        .insert({ author_id: null, prompt: d.quiz.prompt, options: d.quiz.options, correct_key: d.quiz.correct_key, explanation: d.quiz.explanation })
        .select('id').single()
      if (qErr || !q) throw new Error('quiz insert')
      const { error: dErr } = await admin.from('challenge_days').insert({
        weekly_case_id: caseId, day_index: d.day_index, reveal_date: addDays(weekStart, d.day_index - 1),
        stage: d.stage, narrative: d.narrative, quiz_id: (q as { id: string }).id,
      })
      if (dErr) throw new Error('day insert')
    }
  } catch {
    await admin.from('weekly_cases').delete().eq('id', caseId)
    return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  }

  return NextResponse.json({ created: true, week_start: weekStart }, { status: 201 })
}
