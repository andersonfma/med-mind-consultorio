import { NextResponse, type NextRequest } from 'next/server'
import type { ChatCompletion } from 'openai'
import { APITimeoutError } from 'openai'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildPatientPrompt } from '@/lib/patients/prompt'
import { SPECIALTIES, DIFFICULTIES } from '@/lib/patients/specialties'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const body = await request.json()

  if (!(SPECIALTIES as readonly string[]).includes(body.specialty))
    return NextResponse.json({ error: 'Invalid specialty' }, { status: 400 })
  if (!(DIFFICULTIES as readonly string[]).includes(body.difficulty))
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })

  let completion: ChatCompletion
  try {
    completion = await openai.chat.completions.create(
      buildPatientPrompt(body.specialty, body.difficulty),
      { timeout: 25_000 }
    ) as ChatCompletion
  } catch (e) {
    if (e instanceof APITimeoutError)
      return NextResponse.json({ error: 'OpenAI timeout' }, { status: 408 })
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  const content = completion.choices[0].message.content
  if (!content)
    return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

  let openAI: Record<string, unknown>
  try { openAI = JSON.parse(content) as Record<string, unknown> }
  catch { return NextResponse.json({ error: 'OpenAI returned invalid JSON' }, { status: 500 }) }

  const age = Math.round(Number(openAI.age))
  if (!Number.isInteger(age) || age < 18 || age > 80)
    return NextResponse.json({ error: 'OpenAI returned invalid age' }, { status: 500 })

  if (openAI.gender !== 'M' && openAI.gender !== 'F')
    return NextResponse.json({ error: 'OpenAI returned invalid gender' }, { status: 500 })
  const gender = openAI.gender as 'M' | 'F'

  const name      = typeof openAI.name === 'string' && openAI.name.trim()
    ? openAI.name.trim() : null
  const complaint = typeof openAI.chief_complaint === 'string' && openAI.chief_complaint.trim()
    ? openAI.chief_complaint.trim() : null
  const status    = typeof openAI.clinical_status === 'string' && openAI.clinical_status.trim()
    ? openAI.clinical_status.trim() : null
  if (!name || !complaint || !status)
    return NextResponse.json({ error: 'OpenAI returned empty required field' }, { status: 500 })

  const conditions = Array.isArray(openAI.conditions)
    ? openAI.conditions.filter((c: unknown): c is string => typeof c === 'string')
    : []

  const { data, error: rpcError } = await supabase.rpc('create_patient', {
    p_name:       name,
    p_age:        age,
    p_gender:     gender,
    p_specialty:  body.specialty,
    p_difficulty: body.difficulty,
    p_complaint:  complaint,
    p_status:     status,
    p_conditions: conditions,
  })

  if (rpcError) {
    if (rpcError.code === 'US001')
      return NextResponse.json({ error: 'No slots available' }, { status: 403 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
