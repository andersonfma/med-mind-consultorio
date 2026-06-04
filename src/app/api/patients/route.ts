import { NextResponse, type NextRequest } from 'next/server'
import type { ChatCompletion } from 'openai'
import { APITimeoutError } from 'openai'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildPatientPrompt } from '@/lib/patients/prompt'
import { SPECIALTIES, DIFFICULTIES } from '@/lib/patients/specialties'

export async function POST(request: NextRequest) {
  // Fix 7: validation before createClient
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const b = body as Record<string, unknown>

  if (!(SPECIALTIES as readonly string[]).includes(b.specialty as string))
    return NextResponse.json({ error: 'Invalid specialty' }, { status: 400 })
  if (!(DIFFICULTIES as readonly string[]).includes(b.difficulty as string))
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })

  // Fix 1: auth check after validation
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let completion: ChatCompletion
  try {
    completion = await openai.chat.completions.create(
      buildPatientPrompt(b.specialty as string, b.difficulty as string),
      { timeout: 25_000 }
    ) as ChatCompletion
  } catch (e) {
    if (e instanceof APITimeoutError)
      return NextResponse.json({ error: 'OpenAI timeout' }, { status: 408 })
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  // Fix 3: guard empty choices array
  if (!completion.choices.length)
    return NextResponse.json({ error: 'OpenAI empty response' }, { status: 500 })

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
    p_specialty:  b.specialty,
    p_difficulty: b.difficulty,
    p_complaint:  complaint,
    p_status:     status,
    p_conditions: conditions,
  })

  if (rpcError) {
    if (rpcError.code === 'US001')
      return NextResponse.json({ error: 'No slots available' }, { status: 409 }) // Fix 5: 403 → 409
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // Fix 4: guard null data from RPC
  if (!data) return NextResponse.json({ error: 'Internal error' }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
