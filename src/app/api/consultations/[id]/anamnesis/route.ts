import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildAnamnesisPrompt } from '@/lib/consultations/prompts'
import { parseAnamnesisResponse } from '@/lib/consultations/parse'
import type { ChatMessage } from '@/lib/consultations/prompts'

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
    .select('chat_history')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

  if (chatHistory.length === 0)
    return NextResponse.json({ error: 'No chat history to analyze' }, { status: 400 })

  let rawContent: string
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.utility,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildAnamnesisPrompt(chatHistory) }],
    }, { timeout: 25_000 })

    if (!completion.choices.length || !completion.choices[0].message.content)
      return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

    rawContent = completion.choices[0].message.content
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const anamnesis = parseAnamnesisResponse(rawContent)

  const { error: updateError } = await supabase
    .from('consultations')
    .update({ anamnesis })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError)
    return NextResponse.json({ error: 'Failed to save anamnesis' }, { status: 500 })

  return NextResponse.json(anamnesis, { status: 200 })
}
