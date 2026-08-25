import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeAiCall, aiQuotaExceededResponse } from '@/lib/usage/quota'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'

const MAX_BYTES = 5_000_000

// Enviesa a transcrição para PT-BR + vocabulário clínico. O gpt-4o-transcribe, mesmo com
// language:'pt', não trava o idioma de forma confiável em áudios curtos/ruidosos (escorrega
// para espanhol/inglês) e erra termos médicos. O `prompt` ancora idioma E jargão — é o
// parâmetro que de fato segura, muito mais que `language` sozinho.
const TRANSCRIPTION_PROMPT =
  'Transcrição em português do Brasil de um médico em consulta clínica. ' +
  'Vocabulário: anamnese, queixa principal, história da doença atual, hipótese diagnóstica, ' +
  'exame físico, ausculta cardíaca e pulmonar, sopro, dispneia, taquicardia, edema, icterícia, ' +
  'abdome, prescrição, posologia, e exames como hemograma, troponina, eletrocardiograma, ' +
  'ultrassonografia e tomografia. Mantenha todos os termos médicos em português.'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await consumeAiCall(supabase)
  if (!quota.ok) return aiQuotaExceededResponse()

  let form: FormData
  try { form = await request.formData() }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.type && !file.type.startsWith('audio/')) return NextResponse.json({ error: 'file must be audio' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Áudio muito longo' }, { status: 413 })

  try {
    const result = await openai.audio.transcriptions.create({
      file: file as File,
      model: MODELS.transcription,
      language: 'pt',
      prompt: TRANSCRIPTION_PROMPT,
    }, { timeout: 25_000 })
    return NextResponse.json({ text: (result.text ?? '').trim() }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
