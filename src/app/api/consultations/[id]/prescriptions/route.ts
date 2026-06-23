import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildPrescriptionEvalPrompt } from '@/lib/prescriptions/prescription-prompts'
import type { Adequacy } from '@/lib/prescriptions/types'
import type { Patient } from '@/types/domain'

const SELECT = 'id, consultation_id, drug_name, posology, source, justification, adequacy, ai_feedback, status, created_at'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { drug_name, posology, justification, source } = body as Record<string, unknown>
  if (!drug_name || typeof drug_name !== 'string' || !drug_name.trim())
    return NextResponse.json({ error: 'drug_name required' }, { status: 400 })
  if (!posology || typeof posology !== 'string' || !posology.trim())
    return NextResponse.json({ error: 'posology required' }, { status: 400 })
  if (drug_name.trim().length > 300)
    return NextResponse.json({ error: 'drug_name too long' }, { status: 400 })
  if (posology.trim().length > 1000)
    return NextResponse.json({ error: 'posology too long' }, { status: 400 })
  if (typeof justification === 'string' && justification.trim().length > 2000)
    return NextResponse.json({ error: 'justification too long' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Patient
  const caseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const just = typeof justification === 'string' ? justification.trim() : null

  // Avaliação pela IA — best-effort: se falhar, salva com adequacy null.
  let adequacy: Adequacy | null = null
  let aiFeedback: string | null = null
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.utility,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: buildPrescriptionEvalPrompt(patient, drug_name.trim(), posology.trim(), just, caseSummary),
      }],
    }, { timeout: 25_000 })
    const raw = completion.choices[0]?.message?.content
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const a = parsed.adequacy
      if (a === 'adequada' || a === 'parcial' || a === 'inadequada') adequacy = a
      if (typeof parsed.feedback === 'string') aiFeedback = parsed.feedback
    }
  } catch {
    // best-effort — segue com adequacy null
  }

  const { data: inserted, error: insertError } = await supabase
    .from('prescriptions')
    .insert({
      consultation_id: id,
      patient_id: patient.id,
      user_id: user.id,
      drug_name: drug_name.trim(),
      posology: posology.trim(),
      source: source === 'catalog' ? 'catalog' : 'free',
      justification: just,
      adequacy,
      ai_feedback: aiFeedback,
      status: 'active',
    })
    .select(SELECT)
    .single()

  if (insertError)
    return NextResponse.json({ error: 'Failed to save prescription' }, { status: 500 })

  return NextResponse.json(inserted, { status: 201 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('prescriptions')
    .select(SELECT)
    .eq('consultation_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error)
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 })

  return NextResponse.json(data ?? [], { status: 200 })
}
