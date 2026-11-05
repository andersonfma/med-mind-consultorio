import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { EXAM_AREAS, EXAM_TYPES, EXAM_QUESTIONS_PER_SIM } from '@/lib/exam/blueprint'

export const dynamic = 'force-dynamic'

// Registra um simulado corrigido (para métricas de uso/desempenho). Best-effort.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await request.json().catch(() => ({})) as { exam?: string; area?: string; score?: number; total?: number }
  const exam = EXAM_TYPES.find((e) => e.key === b.exam)?.key
  const area = EXAM_AREAS.find((a) => a.key === b.area)?.key
  // total limitado ao tamanho real do simulado; score nunca maior que total.
  const total = Number.isFinite(b.total)
    ? Math.min(EXAM_QUESTIONS_PER_SIM, Math.max(1, Math.trunc(b.total as number))) : null
  const score = Number.isFinite(b.score) && total !== null
    ? Math.min(total, Math.max(0, Math.trunc(b.score as number))) : null
  if (!exam || !area || score === null || total === null) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const db = supabase as unknown as SupabaseClient
  await db.from('exam_attempts').insert({ user_id: user.id, exam, area, score, total } as never)
  return NextResponse.json({ ok: true }, { status: 200 })
}
