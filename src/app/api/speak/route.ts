import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeAiCall, aiQuotaExceededResponse } from '@/lib/usage/quota'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'

const MAX_CHARS = 4000
const ALLOWED_VOICES = ['onyx', 'shimmer']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await consumeAiCall(supabase)
  if (!quota.ok) return aiQuotaExceededResponse()

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { text, voice } = body as Record<string, unknown>
  if (typeof text !== 'string' || !text.trim())
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  if (text.length > MAX_CHARS)
    return NextResponse.json({ error: 'text too long' }, { status: 400 })
  const useVoice = typeof voice === 'string' && ALLOWED_VOICES.includes(voice) ? voice : 'shimmer'

  try {
    const speech = await openai.audio.speech.create({
      model: MODELS.tts,
      voice: useVoice,
      input: text,
      response_format: 'mp3',
    }, { timeout: 25_000 })
    const buffer = Buffer.from(await speech.arrayBuffer())
    return new NextResponse(buffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
  } catch {
    return NextResponse.json({ error: 'Speech synthesis failed' }, { status: 500 })
  }
}
