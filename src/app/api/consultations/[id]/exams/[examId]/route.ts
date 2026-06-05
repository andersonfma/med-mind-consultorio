import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildExamValidationPrompt, buildExamResultPrompt } from '@/lib/exams/exam-prompts'
import type { Patient } from '@/types/domain'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { justification } = body as Record<string, unknown>
  if (!justification || typeof justification !== 'string' || !justification.trim())
    return NextResponse.json({ error: 'justification required' }, { status: 400 })
  if (justification.trim().length > 2000)
    return NextResponse.json({ error: 'justification too long' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, examId } = await params

  const { data: exam, error: eError } = await supabase
    .from('exam_requests')
    .select('*')
    .eq('id', examId)
    .eq('consultation_id', id)
    .eq('user_id', user.id)
    .single()

  if (eError || !exam)
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 })

  if (exam.status === 'approved')
    return NextResponse.json({ error: 'Exam already approved' }, { status: 400 })

  if (exam.attempts >= 3)
    return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 409 })

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('clinical_reasoning, physical_exam, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Patient
  const clinicalReasoning = consultation.clinical_reasoning ?? ''
  const physicalExam = consultation.physical_exam as Record<string, string> ?? {}
  const physicalExamSummary = physicalExam.sinais_vitais
    ? `Sinais vitais: ${physicalExam.sinais_vitais}`
    : ''

  let approved: boolean
  let aiFeedback: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: buildExamValidationPrompt(
          patient, exam.exam_name, justification.trim(),
          clinicalReasoning, physicalExamSummary
        ),
      }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    const parsed = JSON.parse(completion.choices[0].message.content) as Record<string, unknown>
    approved = parsed.approved === true
    aiFeedback = typeof parsed.feedback === 'string' ? parsed.feedback : ''
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  let result: string | null = exam.result
  if (approved && !result) {
    try {
      const resultCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: buildExamResultPrompt(patient, exam.exam_name) }],
      }, { timeout: 25_000 })
      result = resultCompletion.choices[0]?.message?.content?.trim() ?? null
    } catch {
      // non-blocking
    }
  }

  const newAttempts = exam.attempts + 1

  const { error: updateError } = await supabase
    .from('exam_requests')
    .update({
      justification: justification.trim(),
      attempts: newAttempts,
      status: approved ? 'approved' : 'rejected',
      ai_feedback: aiFeedback,
      result: approved ? result : null,
    })
    .eq('id', examId)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to update exam' }, { status: 500 })

  return NextResponse.json({
    status: approved ? 'approved' : 'rejected',
    ai_feedback: aiFeedback,
    attempts: newAttempts,
    result: approved ? result : null,
  }, { status: 200 })
}
