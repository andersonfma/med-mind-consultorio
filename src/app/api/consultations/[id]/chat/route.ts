import { NextResponse, type NextRequest } from 'next/server'
import { APIConnectionTimeoutError } from 'openai'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildPatientSystemPrompt } from '@/lib/consultations/prompts'
import type { ChatMessage } from '@/lib/consultations/prompts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { message } = body as Record<string, unknown>
  if (!message || typeof message !== 'string' || !message.trim())
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  if (message.trim().length > 2000)
    return NextResponse.json({ error: 'message too long' }, { status: 400 })

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
  const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

  // Fetch approved exam results from the last finished consultation for this patient
  let pendingResults: string[] | undefined
  const patientId = (patient as Record<string, unknown>).id as string
  const { data: lastConsultation } = await supabase
    .from('consultations')
    .select('id')
    .eq('patient_id', patientId)
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(1)
    .single()

  if (lastConsultation) {
    const { data: examResults } = await supabase
      .from('exam_requests')
      .select('exam_name, result')
      .eq('consultation_id', lastConsultation.id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
    if (examResults && examResults.length > 0) {
      pendingResults = examResults.map((e: { exam_name: string; result: string | null }) =>
        e.result ? `${e.exam_name}: ${e.result}` : e.exam_name
      )
    }
  }

  const isFirstConsultation = !lastConsultation
  const caseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const systemPrompt = buildPatientSystemPrompt(patient as never, pendingResults, isFirstConsultation, caseSummary)

  // Map roles: student→user, patient→assistant (OpenAI only accepts standard roles)
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...chatHistory.map(m => ({
      role: m.role === 'student' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
    { role: 'user' as const, content: message.trim() },
  ]

  let patientReply: string
  try {
    const completion = await openai.chat.completions.create(
      { model: MODELS.chat, messages },
      { timeout: 25_000 }
    )
    if (!completion.choices.length)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })
    patientReply = completion.choices[0].message.content ?? ''
    if (!patientReply)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })
  } catch (e) {
    if (e instanceof APIConnectionTimeoutError)
      return NextResponse.json({ error: 'OpenAI timeout' }, { status: 408 })
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const newHistory: ChatMessage[] = [
    ...chatHistory,
    { role: 'student', content: message.trim(), timestamp: now },
    { role: 'patient', content: patientReply, timestamp: now },
  ]

  const { error: updateError } = await supabase
    .from('consultations')
    .update({ chat_history: newHistory })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })

  return NextResponse.json({ reply: patientReply }, { status: 200 })
}
