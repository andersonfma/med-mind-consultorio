import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { consumeAiCall, aiQuotaExceededResponse } from '@/lib/usage/quota'
import { generateExam } from '@/lib/exam/generate'
import { EXAM_AREAS, EXAM_TYPES, EXAM_QUESTIONS_PER_SIM, PRE_REQ_SPECIALTIES, type ExamType, type ExamTrack } from '@/lib/exam/blueprint'

export const dynamic = 'force-dynamic'

// Gera um simulado curto por área (ENARE/ENAMED). Premium only.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = supabase as unknown as SupabaseClient
  const { data: prof } = await db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle()
  if (!(prof as { is_premium?: boolean } | null)?.is_premium) {
    return NextResponse.json({ error: 'premium_only', message: 'Os simulados são um recurso Premium.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { area?: string; exam?: string; track?: string }
  const exam = EXAM_TYPES.find((e) => e.key === body.exam)?.key as ExamType | undefined
  if (!exam) return NextResponse.json({ error: 'Exame inválido' }, { status: 400 })
  const track: ExamTrack = exam === 'enare' && body.track === 'pre-requisito' ? 'pre-requisito' : 'acesso-direto'
  const area = (track === 'pre-requisito'
    ? PRE_REQ_SPECIALTIES.find((s) => s.key === body.area)?.key
    : EXAM_AREAS.find((a) => a.key === body.area)?.key)
  if (!area) return NextResponse.json({ error: 'Área inválida' }, { status: 400 })

  // Controle de custo: consome 1 chamada de IA (premium é ilimitado no RPC).
  const quota = await consumeAiCall(db)
  if (!quota.ok) return aiQuotaExceededResponse()

  const questions = await generateExam(exam, area, EXAM_QUESTIONS_PER_SIM, track)
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'Falha ao gerar o simulado. Tente de novo.' }, { status: 502 })
  }
  return NextResponse.json({ exam, area, track, questions }, { status: 200 })
}
