import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SELECT = 'id, consultation_id, drug_name, posology, source, justification, adequacy, ai_feedback, status, created_at'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prescriptionId } = await params

  const { data, error } = await supabase
    .from('prescriptions')
    .update({ status: 'suspended' })
    .eq('id', prescriptionId)
    .eq('user_id', user.id)
    .select(SELECT)
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Failed to suspend prescription' }, { status: 500 })

  return NextResponse.json(data, { status: 200 })
}
