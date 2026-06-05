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

  // Generate true diagnosis if not yet generated — use clinical data for accuracy
  let trueDiagnosis = patient.true_diagnosis as string | null
  if (!trueDiagnosis) {
    // Fetch the latest finished consultation's clinical data for better inference
    let clinicalContext = ''
    try {
      const { data: lastConsult } = await supabase
        .from('consultations')
        .select('id, chat_history, anamnesis, physical_exam, clinical_reasoning')
        .eq('patient_id', id)
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
        .limit(1)
        .single()

      if (lastConsult) {
        const anamnesis = lastConsult.anamnesis as Record<string, string> | null
        const physExam = lastConsult.physical_exam as Record<string, string> | null
        const parts: string[] = []
        if (anamnesis?.hda) parts.push(`HDA: ${anamnesis.hda}`)
        if (anamnesis?.hpp) parts.push(`HPP: ${anamnesis.hpp}`)
        if (anamnesis?.ad) parts.push(`AD: ${anamnesis.ad}`)
        if (physExam?.sinais_vitais) parts.push(`Sinais vitais: ${physExam.sinais_vitais}`)
        if (physExam?.aparelho_cardiovascular) parts.push(`Cardiovascular: ${physExam.aparelho_cardiovascular}`)
        if (physExam?.sistemas_adicionais) {
          const sistemas = physExam.sistemas_adicionais as unknown as Record<string, string>
          Object.entries(sistemas).forEach(([k, v]) => parts.push(`${k}: ${v}`))
        }
        if (lastConsult.clinical_reasoning) parts.push(`Pensamento clínico do aluno: ${lastConsult.clinical_reasoning}`)

        // Include approved exam results — critical for diagnosis accuracy
        const { data: exams } = await supabase
          .from('exam_requests')
          .select('exam_name, result')
          .eq('consultation_id', lastConsult.id)
          .eq('user_id', user.id)
          .eq('status', 'approved')
        if (exams && exams.length > 0) {
          parts.push('Resultados de exames:')
          exams.forEach((e: { exam_name: string; result: string | null }) => {
            parts.push(`  ${e.exam_name}: ${e.result ?? '(sem laudo)'}`)
          })
        }

        clinicalContext = parts.join('\n')
      }
    } catch { /* non-blocking */ }

    try {
      const promptText = clinicalContext
        ? `${buildTrueDiagnosisOnlyPrompt(patient as unknown as Patient)}\n\nDados clínicos coletados nas consultas:\n${clinicalContext}`
        : buildTrueDiagnosisOnlyPrompt(patient as unknown as Patient)

      const diagCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: promptText }],
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
