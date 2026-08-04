import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'

const MAX_BYTES = 5_000_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await request.formData() }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Áudio muito longo' }, { status: 413 })

  try {
    const result = await openai.audio.transcriptions.create({
      file: file as File,
      model: MODELS.transcription,
      language: 'pt',
    }, { timeout: 25_000 })
    return NextResponse.json({ text: (result.text ?? '').trim() }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
