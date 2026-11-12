import { NextResponse, type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { generateDiseaseMap } from '@/lib/disease-map/generate'

export const dynamic = 'force-dynamic'

const FREE_MAP_LIMIT = 1

// Gera o "Mapa da Doença" (correlação centrada na fisiopatogênese). 1 grátis
// (lifetime, contando disease_maps do usuário), depois Premium. Salva o mapa.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { disease?: string }
  const disease = (body.disease ?? '').trim()
  if (!disease) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const db = supabase as unknown as SupabaseClient

  const { data: prof } = await db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle()
  const isPremium = !!(prof as { is_premium?: boolean } | null)?.is_premium
  if (!isPremium) {
    const { count } = await db.from('disease_maps').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= FREE_MAP_LIMIT) {
      return NextResponse.json({ error: 'premium_required', message: 'Você já usou seu mapa grátis. Assine o Premium para mapas ilimitados.' }, { status: 403 })
    }
  }

  const result = await generateDiseaseMap(disease)
  if (!result) return NextResponse.json({ error: 'generation_failed', message: 'Não foi possível gerar o mapa. Tente de novo.' }, { status: 502 })
  if ('outOfScope' in result) {
    return NextResponse.json({ error: 'out_of_scope', message: 'Não reconheci isso como uma doença da clínica médica. Tente outro nome.' }, { status: 422 })
  }

  const { data: saved, error } = await db
    .from('disease_maps')
    .insert({ user_id: user.id, disease: result.disease, area: result.area, data: result } as never)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 })

  return NextResponse.json({ map: result, id: (saved as { id: string }).id }, { status: 200 })
}
