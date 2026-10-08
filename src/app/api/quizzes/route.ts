import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type Opt = { key: string; text: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { prompt?: unknown; options?: unknown; correctKey?: unknown; explanation?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 500) : ''
  const correctKey = typeof body.correctKey === 'string' ? body.correctKey : ''
  const explanation = typeof body.explanation === 'string' ? body.explanation.trim().slice(0, 1000) : null
  const rawOpts = Array.isArray(body.options) ? body.options : []
  const options: Opt[] = rawOpts
    .filter((o): o is Opt => !!o && typeof (o as Opt).key === 'string' && typeof (o as Opt).text === 'string' && !!(o as Opt).text.trim())
    .map(o => ({ key: o.key, text: o.text.trim().slice(0, 300) }))

  if (!prompt) return NextResponse.json({ error: 'Enunciado vazio' }, { status: 422 })
  if (options.length < 2 || options.length > 5) return NextResponse.json({ error: 'Use de 2 a 5 alternativas' }, { status: 422 })
  if (!options.some(o => o.key === correctKey)) return NextResponse.json({ error: 'Marque a alternativa correta' }, { status: 422 })

  const db = supabase as unknown as SupabaseClient
  const { data: q, error: qErr } = await db.from('quizzes')
    .insert({ author_id: user.id, prompt, options, correct_key: correctKey, explanation })
    .select('id').single()
  if (qErr || !q) return NextResponse.json({ error: 'Falha ao criar quiz' }, { status: 500 })
  const quizId = (q as { id: string }).id

  const { data: p, error: pErr } = await db.from('posts')
    .insert({ author_id: user.id, kind: 'quiz', quiz_id: quizId, body: null })
    .select('id').single()
  if (pErr || !p) return NextResponse.json({ error: 'Falha ao publicar' }, { status: 500 })

  return NextResponse.json({ postId: (p as { id: string }).id, quizId }, { status: 201 })
}
