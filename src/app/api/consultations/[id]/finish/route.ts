import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildFinishPrompt, buildCaseSummaryPrompt, type ChatMessage } from '@/lib/consultations/prompts'
import { buildAb4ScorePrompt, type Ab4ExamInput } from '@/lib/consultations/ab4-prompts'
import { parseAb4Response, type Ab4Result } from '@/lib/consultations/ab4'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('*, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Record<string, unknown>
  const clinicalReasoning = consultation.clinical_reasoning ?? ''

  // Generate new clinical_status anchored to true_diagnosis (not student hypothesis)
  let newClinicalStatus: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: buildFinishPrompt(patient as never, clinicalReasoning),
      }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    newClinicalStatus = completion.choices[0].message.content.trim()
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Update patient: clinical_status and last_consulted_at (no longer saving student's diagnosis here)
  const { error: pUpdateError } = await supabase
    .from('patients')
    .update({
      clinical_status: newClinicalStatus,
      last_consulted_at: now,
    })
    .eq('id', patient.id as string)
    .eq('user_id', user.id)

  if (pUpdateError)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })

  const { error: cUpdateError } = await supabase
    .from('consultations')
    .update({ status: 'finished', finished_at: now })
    .eq('id', id)
    .eq('user_id', user.id)

  if (cUpdateError)
    return NextResponse.json({ error: 'Failed to finish consultation' }, { status: 500 })

  // Generate cumulative case summary (non-blocking)
  try {
    const { data: examRows } = await supabase
      .from('exam_requests')
      .select('exam_name, result')
      .eq('consultation_id', id)
      .eq('user_id', user.id)
      .eq('status', 'approved')

    const priorSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
    const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: buildCaseSummaryPrompt(
          patient as never, priorSummary, chatHistory, clinicalReasoning, examRows ?? []
        ),
      }],
    }, { timeout: 25_000 })

    const newSummary = summaryCompletion.choices[0]?.message?.content?.trim()
    if (newSummary) {
      await supabase
        .from('patients')
        .update({ case_summary: newSummary })
        .eq('id', patient.id as string)
        .eq('user_id', user.id)
    }
  } catch {
    // Non-blocking — finish já concluído mesmo se o resumo falhar
  }

  // Evaluate if student's clinical_reasoning mentions the correct diagnosis (non-blocking)
  let diagnosisAchieved = false
  try {
    const currentPatient = (await supabase
      .from('patients')
      .select('diagnosis_status, true_diagnosis')
      .eq('id', patient.id as string)
      .single()).data

    if (currentPatient?.diagnosis_status === 'none' && clinicalReasoning.trim()) {
      const { buildTrueDiagnosisAndEvalPrompt } = await import('@/lib/patients/diagnosis-prompts')
      const evalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildTrueDiagnosisAndEvalPrompt(patient as never, clinicalReasoning) }],
      }, { timeout: 25_000 })

      if (evalCompletion.choices[0]?.message?.content) {
        const evalResult = JSON.parse(evalCompletion.choices[0].message.content) as {
          true_diagnosis: string
          compatible: boolean
          reasoning: string
        }
        await supabase
          .from('patients')
          .update({
            true_diagnosis: evalResult.true_diagnosis,
            ...(evalResult.compatible ? { diagnosis_status: 'achieved' } : {}),
          })
          .eq('id', patient.id as string)
          .eq('user_id', user.id)
        diagnosisAchieved = evalResult.compatible
      }
    }
  } catch {
    // Non-blocking
  }

  // AB4 score — best-effort (nunca quebra o finish)
  let ab4: (Ab4Result & { generated_at: string }) | null = null
  try {
    const { data: examRows } = await supabase
      .from('exam_requests')
      .select('exam_name, justification, result, status')
      .eq('consultation_id', id)
      .eq('user_id', user.id)

    const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]
    const physicalExam = (consultation.physical_exam ?? {}) as Record<string, string>
    const physicalExamSummary = physicalExam.sinais_vitais
      ? `Sinais vitais: ${physicalExam.sinais_vitais}`
      : ''

    const ab4Completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: buildAb4ScorePrompt(
          patient as never,
          chatHistory,
          (examRows ?? []) as Ab4ExamInput[],
          physicalExamSummary,
          clinicalReasoning,
        ),
      }],
    }, { timeout: 25_000 })

    const raw = ab4Completion.choices[0]?.message?.content
    const parsed = raw ? parseAb4Response(raw) : null
    if (parsed) {
      ab4 = { ...parsed, generated_at: new Date().toISOString() }
      await supabase
        .from('consultations')
        .update({ ab4_score: ab4 as unknown as import('@/types/database').Json })
        .eq('id', id)
        .eq('user_id', user.id)
    }
  } catch {
    // Best-effort — finish conclui mesmo se o AB4 falhar
  }

  return NextResponse.json({ patient_id: patient.id, diagnosis_achieved: diagnosisAchieved, ab4 }, { status: 200 })
}
