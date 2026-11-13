import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import type { DiseaseMap } from '@/lib/disease-map/schema'
import { DiseaseMapView } from '../DiseaseMapView'

export const dynamic = 'force-dynamic'

export default async function MapaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const db = supabase as unknown as SupabaseClient
  const { data: row } = await db
    .from('disease_maps').select('data')
    .eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!row) notFound()
  const map = (row as { data: DiseaseMap }).data

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2">
      <Link href="/mapa" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-primary">← Voltar aos mapas</Link>
      <DiseaseMapView map={map} />
    </div>
  )
}
