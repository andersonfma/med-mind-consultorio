import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { patient_id } = body as Record<string, unknown>
  if (!patient_id || typeof patient_id !== 'string')
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the patient belongs to the authenticated user (prevents IDOR)
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patient_id)
    .eq('user_id', user.id)
    .single()

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 403 })

  // Check for existing ongoing consultation scoped to this user (prevents info disclosure)
  const { data: existing } = await supabase
    .from('consultations')
    .select('id')
    .eq('patient_id', patient_id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (existing) return NextResponse.json({ id: existing.id }, { status: 200 })

  const { data, error } = await supabase
    .from('consultations')
    .insert({ patient_id, user_id: user.id })
    .select('id')
    .single()

  if (error) {
    // Race condition: another request inserted simultaneously (UNIQUE VIOLATION)
    if (error.code === '23505') {
      const { data: raceExisting } = await supabase
        .from('consultations')
        .select('id')
        .eq('patient_id', patient_id)
        .eq('user_id', user.id)
        .eq('status', 'ongoing')
        .single()
      return NextResponse.json({ id: raceExisting!.id }, { status: 200 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
