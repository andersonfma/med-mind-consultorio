import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildFinishPrompt } from '@/lib/consultations/prompts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { diagnosis } = body as Record<string, unknown>
  if (!diagnosis || typeof diagnosis !== 'string' || !diagnosis.trim())
    return NextResponse.json({ error: 'diagnosis required' }, { status: 400 })
  if (diagnosis.trim().length > 5000)
    return NextResponse.json({ error: 'diagnosis too long' }, { status: 400 })

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

  let newClinicalStatus: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: buildFinishPrompt(patient as never, diagnosis.trim(), clinicalReasoning),
      }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    newClinicalStatus = completion.choices[0].message.content.trim()
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const now = new Date().toISOString()

  const { error: pUpdateError } = await supabase
    .from('patients')
    .update({
      clinical_status: newClinicalStatus,
      last_consulted_at: now,
      diagnosis: diagnosis.trim(),
    })
    .eq('id', patient.id as string)
    .eq('user_id', user.id)

  if (pUpdateError)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })

  const { error: cUpdateError } = await supabase
    .from('consultations')
    .update({ status: 'finished', finished_at: now, diagnosis: diagnosis.trim() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (cUpdateError)
    return NextResponse.json({ error: 'Failed to finish consultation' }, { status: 500 })

  // Evaluate student's diagnosis vs true diagnosis
  let diagnosisAchieved = false
  try {
    const currentPatient = (await supabase
      .from('patients')
      .select('diagnosis_status, true_diagnosis')
      .eq('id', patient.id as string)
      .single()).data

    if (currentPatient?.diagnosis_status === 'none') {
      const { buildTrueDiagnosisAndEvalPrompt } = await import('@/lib/patients/diagnosis-prompts')
      const evalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildTrueDiagnosisAndEvalPrompt(patient as never, diagnosis.trim()) }],
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
    // Non-blocking — evaluation failure doesn't fail the consultation finish
  }

  return NextResponse.json({ patient_id: patient.id, diagnosis_achieved: diagnosisAchieved }, { status: 200 })
}
