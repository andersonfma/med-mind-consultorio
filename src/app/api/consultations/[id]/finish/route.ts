import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildFinishPrompt, buildCaseSummaryPrompt, type ChatMessage, type TreatmentContext } from '@/lib/consultations/prompts'
import { buildAb4ScorePrompt, type Ab4ExamInput } from '@/lib/consultations/ab4-prompts'
import { parseAb4Response, emptyReasoningResult, type Ab4Result } from '@/lib/consultations/ab4'
import { estimateAdherence } from '@/lib/prescriptions/adherence'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // O cliente envia o texto atual do pensamento clínico no corpo, para evitar a
  // corrida com o autosave de 30s (texto recém-digitado pode não ter sido persistido).
  let bodyReasoning: string | null = null
  try {
    const body = await request.json() as Record<string, unknown>
    if (typeof body?.clinical_reasoning === 'string') bodyReasoning = body.clinical_reasoning
  } catch {
    // corpo ausente/ inválido — usa o valor já persistido no banco
  }

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
  // Fonte da verdade: o texto enviado pelo cliente (mais recente). Cai para o banco se ausente.
  const clinicalReasoning = bodyReasoning ?? consultation.clinical_reasoning ?? ''

  // Etapa da consulta: o case_summary só existe APÓS uma consulta finalizada anterior.
  // Sem ele → primeira consulta (etapa 1: AB4 só A1/A2, sem conclusão de diagnóstico).
  const priorCaseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const isFirstConsultation = !(priorCaseSummary && priorCaseSummary.trim())
  const ab4Stage: 1 | 2 = isFirstConsultation ? 1 : 2

  // Diagnóstico já fechado (alcançado ou revelado) numa consulta ANTERIOR → esta é uma
  // consulta de SEGUIMENTO: o arco diagnóstico (AB4) já terminou e foi avaliado. Não
  // reavaliamos o AB4; se o aluno registrar pensamento clínico, fica só como nota de
  // acompanhamento. Baseado no status NO INÍCIO da consulta — a consulta em que o
  // diagnóstico é fechado (status 'none' ao carregar) ainda recebe AB4 normalmente.
  const diagnosisStatus = (patient as Record<string, unknown>).diagnosis_status as string | null
  const isFollowUp = diagnosisStatus === 'achieved' || diagnosisStatus === 'revealed'

  // Contexto de tratamento (best-effort): prescrições ATIVAS do paciente cruzadas com a
  // adesão estimada (vínculo × personalidade). Alimenta a evolução clínica e o resumo.
  // Escopo por PACIENTE (não por consulta) é intencional: o tratamento é longitudinal —
  // medicações ativas persistem entre consultas até serem suspensas (mesmo critério da
  // rota do chat). Se a coleta falhar, o encerramento segue sem efeito de tratamento.
  let treatment: TreatmentContext | undefined
  try {
    const { data: rxRows } = await supabase
      .from('prescriptions')
      .select('drug_name, posology, adequacy')
      .eq('patient_id', patient.id as string)
      .eq('user_id', user.id)
      .eq('status', 'active')
    if (rxRows && rxRows.length > 0) {
      const bond = (patient as Record<string, unknown>).bond_level as number ?? 3
      const personality = (patient as Record<string, unknown>).personality as string | null
      treatment = {
        prescriptions: rxRows.map(r => ({
          drug_name: r.drug_name as string,
          posology: r.posology as string,
          adequacy: (r.adequacy as string | null) ?? null,
        })),
        adherence: estimateAdherence(bond, personality),
      }
    }
  } catch {
    // best-effort — segue sem efeito de tratamento
  }

  // Generate new clinical_status anchored to true_diagnosis (not student hypothesis)
  let newClinicalStatus: string
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.utility,
      messages: [{
        role: 'user',
        content: buildFinishPrompt(patient as never, clinicalReasoning, treatment),
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
    .update({ status: 'finished', finished_at: now, clinical_reasoning: clinicalReasoning })
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

    const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

    const summaryCompletion = await openai.chat.completions.create({
      model: MODELS.utility,
      messages: [{
        role: 'user',
        content: buildCaseSummaryPrompt(
          patient as never, priorCaseSummary, chatHistory, clinicalReasoning, examRows ?? [], treatment
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

  // Evaluate if student's clinical_reasoning mentions the correct diagnosis (non-blocking).
  // SÓ a partir da 2ª consulta: na 1ª não se conclui o caso (sem resultados de exame ainda),
  // então o diagnóstico não é marcado como "alcançado" — segue a via de "revelar diagnóstico".
  let diagnosisAchieved = false
  try {
    const currentPatient = (await supabase
      .from('patients')
      .select('diagnosis_status, true_diagnosis')
      .eq('id', patient.id as string)
      .single()).data

    if (!isFirstConsultation && currentPatient?.diagnosis_status === 'none' && clinicalReasoning.trim()) {
      const { buildTrueDiagnosisAndEvalPrompt } = await import('@/lib/patients/diagnosis-prompts')
      const evalCompletion = await openai.chat.completions.create({
        model: MODELS.utility,
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

  // AB4 score — best-effort (nunca quebra o finish).
  // Em consulta de seguimento (diagnóstico já fechado), o arco AB4 acabou: não pontuamos.
  let ab4: (Ab4Result & { generated_at: string }) | null = null
  if (!isFollowUp) try {
    // Etapa 2: herda A1/A2 da PRIMEIRA consulta (poética/retórica foram avaliadas lá;
    // não se reavalia a abertura do raciocínio numa consulta de retorno).
    let carried: { a1: number; a2: number } | null = null
    if (ab4Stage === 2) {
      const { data: priorRows } = await supabase
        .from('consultations')
        .select('ab4_score')
        .eq('patient_id', patient.id as string)
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .neq('id', id)
        .not('ab4_score', 'is', null)
        .order('finished_at', { ascending: true })
        .limit(1)
      const priorScore = priorRows?.[0]?.ab4_score as { a1?: unknown; a2?: unknown } | null | undefined
      if (priorScore && typeof priorScore.a1 === 'number' && typeof priorScore.a2 === 'number') {
        carried = { a1: priorScore.a1, a2: priorScore.a2 }
      }
    }

    if (!clinicalReasoning.trim()) {
      // Sem pensamento clínico registrado → não há raciocínio a avaliar; score zerado.
      ab4 = { ...emptyReasoningResult(ab4Stage, carried), generated_at: new Date().toISOString() }
    } else {
      const { data: examRows } = await supabase
        .from('exam_requests')
        .select('exam_name, justification, result, status')
        .eq('consultation_id', id)
        .eq('user_id', user.id)

      const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]
      const physicalExam = (consultation.physical_exam ?? {}) as Record<string, unknown>
      const peLabels: Record<string, string> = {
        antropometria: 'Antropometria',
        inspecao_geral: 'Inspeção geral',
        sinais_vitais: 'Sinais vitais',
        aparelho_respiratorio: 'Aparelho respiratório',
        aparelho_cardiovascular: 'Aparelho cardiovascular',
        abdome: 'Abdome',
        membros_inferiores: 'Membros inferiores',
      }
      const physicalExamSummary = Object.entries(peLabels)
        .map(([k, label]) => {
          const v = physicalExam[k]
          return typeof v === 'string' && v.trim() ? `${label}: ${v.trim()}` : ''
        })
        .filter(Boolean)
        .join('\n')

      const ab4Completion = await openai.chat.completions.create({
        model: MODELS.utility,
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
            ab4Stage,
            carried,
          ),
        }],
      }, { timeout: 25_000 })

      const raw = ab4Completion.choices[0]?.message?.content
      const parsed = raw ? parseAb4Response(raw, ab4Stage, carried) : null
      if (parsed) ab4 = { ...parsed, generated_at: new Date().toISOString() }
    }

    if (ab4) {
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
