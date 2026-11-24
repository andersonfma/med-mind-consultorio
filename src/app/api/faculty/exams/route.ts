import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { managedInstitutions } from '@/lib/faculty/access'
import { buildPlan, generateFacultyExam, type ExamMode, type ExamSpec } from '@/lib/faculty/exam-generate'
import type { ExamType, ExamTrack } from '@/lib/exam/blueprint'

export const dynamic = 'force-dynamic'

// Cria uma prova da turma e dispara a geração em background. Só coordenador/admin da instituição.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { institutions } = await managedInstitutions(user.id, user.email)
  const body = await request.json().catch(() => ({})) as {
    institutionId?: string; title?: string; exam?: string; track?: string; mode?: string; spec?: ExamSpec
  }

  const institutionId = String(body.institutionId ?? '')
  if (!institutions.some((i) => i.id === institutionId)) {
    return NextResponse.json({ error: 'Instituição não encontrada ou sem acesso' }, { status: 403 })
  }

  const exam: ExamType = body.exam === 'enamed' ? 'enamed' : 'enare'
  const track: ExamTrack = exam === 'enare' && body.track === 'pre-requisito' ? 'pre-requisito' : 'acesso-direto'
  const mode: ExamMode = body.mode === 'blueprint' ? 'blueprint' : 'random'
  const title = String(body.title ?? '').trim().slice(0, 120) || 'Prova sem título'
  const spec = (body.spec ?? {}) as ExamSpec

  // Valida que o plano tem ao menos 1 questão.
  const plan = buildPlan(exam, track, mode, spec)
  const planTotal = plan.reduce((s, p) => s + p.n, 0)
  if (planTotal === 0) {
    return NextResponse.json({ error: 'Defina ao menos uma área/tema com questões.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('faculty_exams')
    .insert({ institution_id: institutionId, author_id: user.id, title, exam, track, mode, spec, status: 'generating', total_questions: 0 } as never)
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Falha ao criar a prova' }, { status: 500 })
  const examId = (data as { id: string }).id

  // Dispara a geração em background (servidor persistente; pode levar minutos).
  void generateFacultyExam(admin, examId).catch(() => { /* status vira 'failed' internamente */ })

  return NextResponse.json({ id: examId, planTotal }, { status: 201 })
}
