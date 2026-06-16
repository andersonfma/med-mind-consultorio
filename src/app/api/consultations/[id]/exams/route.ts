import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildExamValidationPrompt, buildExamResultPrompt } from '@/lib/exams/exam-prompts'
import { cleanExamResult } from '@/lib/exams/clean'
import type { Patient } from '@/types/domain'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { exam_name, justification } = body as Record<string, unknown>
  if (!exam_name || typeof exam_name !== 'string' || !exam_name.trim())
    return NextResponse.json({ error: 'exam_name required' }, { status: 400 })
  if (!justification || typeof justification !== 'string' || !justification.trim())
    return NextResponse.json({ error: 'justification required' }, { status: 400 })
  if (exam_name.trim().length > 500)
    return NextResponse.json({ error: 'exam_name too long' }, { status: 400 })
  if (justification.trim().length > 2000)
    return NextResponse.json({ error: 'justification too long' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('clinical_reasoning, physical_exam, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()


  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  // Check if exam already exists for this consultation
  const { data: existing } = await supabase
    .from('exam_requests')
    .select('id, status, attempts')
    .eq('consultation_id', id)
    .eq('user_id', user.id)
    .eq('exam_name', exam_name.trim())
    .single()

  if (existing) {
    if (existing.status === 'approved')
      return NextResponse.json({ error: 'Exam already approved' }, { status: 409 })
    if (existing.attempts >= 3)
      return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 409 })
    return NextResponse.json({ error: 'Use retry endpoint for existing exam' }, { status: 409 })
  }

  const patient = (consultation as Record<string, unknown>).patients as Patient
  const clinicalReasoning = consultation.clinical_reasoning ?? ''
  const physicalExam = consultation.physical_exam as Record<string, string> ?? {}
  const physicalExamSummary = physicalExam.sinais_vitais
    ? `Sinais vitais: ${physicalExam.sinais_vitais}`
    : ''
  const caseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const isFollowUp = !!(caseSummary && caseSummary.trim())

  let approved: boolean
  let aiFeedback: string
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.utility,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: buildExamValidationPrompt(
          patient, exam_name.trim(), justification.trim(),
          clinicalReasoning, physicalExamSummary, caseSummary, isFollowUp
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

  let result: string | null = null
  if (approved) {
    try {
      const trueDiagnosis = (patient as Record<string, unknown>).true_diagnosis as string | null ?? null
      const resultCompletion = await openai.chat.completions.create({
        model: MODELS.utility,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: buildExamResultPrompt(patient, exam_name.trim(), trueDiagnosis),
        }],
      }, { timeout: 25_000 })
      const raw = resultCompletion.choices[0]?.message?.content?.trim()
      result = raw ? cleanExamResult(raw) : null
    } catch {
      // non-blocking — exam still approved without result
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('exam_requests')
    .insert({
      consultation_id: id,
      patient_id: patient.id,
      user_id: user.id,
      exam_name: exam_name.trim(),
      justification: justification.trim(),
      attempts: 1,
      status: approved ? 'approved' : 'rejected',
      ai_feedback: aiFeedback,
      result,
    })
    .select('id, consultation_id, exam_name, justification, attempts, status, ai_feedback, created_at')
    .single()

  if (insertError)
    return NextResponse.json({ error: 'Failed to save exam request' }, { status: 500 })

  return NextResponse.json(inserted, { status: 201 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('exam_requests')
    .select('id, consultation_id, exam_name, justification, attempts, status, ai_feedback, created_at')
    .eq('consultation_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error)
    return NextResponse.json({ error: 'Failed to fetch exams' }, { status: 500 })

  return NextResponse.json(data ?? [], { status: 200 })
}
