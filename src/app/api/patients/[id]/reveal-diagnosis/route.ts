import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import {
  buildTrueDiagnosisOnlyPrompt,
  buildClinicalSummaryPrompt,
} from '@/lib/patients/diagnosis-prompts'
import type { Patient } from '@/types/domain'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: patient, error: pError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (pError || !patient)
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  if (patient.diagnosis_status !== 'none')
    return NextResponse.json({ error: 'Diagnosis already revealed or achieved' }, { status: 409 })

  // Eligibility: ≥2 finished consultations
  const { count: consultationCount } = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', id)
    .eq('user_id', user.id)
    .eq('status', 'finished')

  if ((consultationCount ?? 0) < 2)
    return NextResponse.json({ error: 'At least 2 consultations required' }, { status: 403 })

  // Eligibility: ≥1 approved exam
  const { count: examCount } = await supabase
    .from('exam_requests')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', id)
    .eq('user_id', user.id)
    .eq('status', 'approved')

  if ((examCount ?? 0) < 1)
    return NextResponse.json({ error: 'At least 1 approved exam required' }, { status: 403 })

  // Generate true diagnosis if not yet generated
  let trueDiagnosis = patient.true_diagnosis as string | null
  if (!trueDiagnosis) {
    try {
      const diagCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildTrueDiagnosisOnlyPrompt(patient as unknown as Patient) }],
      }, { timeout: 25_000 })
      const parsed = JSON.parse(diagCompletion.choices[0]?.message?.content ?? '{}') as { true_diagnosis?: string }
      trueDiagnosis = parsed.true_diagnosis ?? 'Diagnóstico não determinado'
    } catch {
      return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
    }
  }

  // Generate clinical summary
  let clinicalSummary = ''
  try {
    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: buildClinicalSummaryPrompt(patient as unknown as Patient, trueDiagnosis),
      }],
    }, { timeout: 25_000 })
    clinicalSummary = summaryCompletion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    // Non-blocking
  }

  const { error: updateError } = await supabase
    .from('patients')
    .update({
      true_diagnosis: trueDiagnosis,
      diagnosis_status: 'revealed',
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })

  return NextResponse.json({ true_diagnosis: trueDiagnosis, clinical_summary: clinicalSummary }, { status: 200 })
}
