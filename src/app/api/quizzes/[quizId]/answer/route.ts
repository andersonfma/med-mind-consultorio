import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Responde um quiz DE USUÁRIO (author_id não nulo). Sem aposta/XP. 1 tentativa. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { chosenKey?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const chosenKey = typeof body.chosenKey === 'string' ? body.chosenKey : ''
  if (!chosenKey) return NextResponse.json({ error: 'chosenKey obrigatório' }, { status: 422 })

  const admin = createAdminClient()
  // gabarito via service role (coluna protegida); garante que é quiz de usuário
  const { data: quizRow } = await admin.from('quizzes').select('author_id, correct_key, explanation').eq('id', quizId).maybeSingle()
  const quiz = quizRow as { author_id: string | null; correct_key: string; explanation: string | null } | null
  if (!quiz || quiz.author_id === null) return NextResponse.json({ error: 'Quiz inválido' }, { status: 404 })

  const { data: prev } = await admin.from('quiz_answers').select('user_id').eq('quiz_id', quizId).eq('user_id', user.id).maybeSingle()
  if (prev) return NextResponse.json({ error: 'Já respondido' }, { status: 409 })

  const isCorrect = chosenKey === quiz.correct_key
  const db = supabase as unknown as SupabaseClient
  const { error } = await db.from('quiz_answers').insert({ quiz_id: quizId, user_id: user.id, chosen_key: chosenKey, is_correct: isCorrect, stake: 0, delta: 0 })
  if (error) return NextResponse.json({ error: 'Falha ao responder' }, { status: 500 })

  const { data: allAns } = await admin.from('quiz_answers').select('is_correct').eq('quiz_id', quizId)
  const rows = (allAns as Array<{ is_correct: boolean }> ?? [])
  const networkPct = rows.length ? Math.round((rows.filter(r => r.is_correct).length / rows.length) * 100) : 0

  return NextResponse.json({ isCorrect, correctKey: quiz.correct_key, explanation: quiz.explanation, networkPct }, { status: 200 })
}
