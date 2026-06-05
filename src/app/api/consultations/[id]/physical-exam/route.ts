import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildPhysicalExamPrompt } from '@/lib/consultations/prompts'
import { parsePhysicalExamResponse } from '@/lib/consultations/parse'
import type { ChatMessage } from '@/lib/consultations/prompts'
import type { Patient } from '@/types/domain'

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
    .select('chat_history, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Patient
  const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

  let rawContent: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: buildPhysicalExamPrompt(patient, chatHistory),
      }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    rawContent = completion.choices[0].message.content
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const physicalExam = parsePhysicalExamResponse(rawContent)

  const { error: updateError } = await supabase
    .from('consultations')
    .update({ physical_exam: physicalExam })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to save physical exam' }, { status: 500 })

  return NextResponse.json(physicalExam, { status: 200 })
}
