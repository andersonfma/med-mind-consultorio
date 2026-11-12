import { redirect } from 'next/navigation'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { DiseaseMapGenerator } from './DiseaseMapGenerator'

export const dynamic = 'force-dynamic'

export default async function MapaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  const { data: saved } = await db
    .from('disease_maps').select('id, disease, area, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  const maps = (saved ?? []) as { id: string; disease: string; area: string | null; created_at: string }[]

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Mapa da Doença</h1>
        <p className="mt-2 max-w-xl text-muted">Entenda a doença pela fisiopatogênese — e veja a clínica, o diagnóstico e o tratamento saírem do mecanismo. Digite uma doença e gere o mapa.</p>
      </header>

      <DiseaseMapGenerator />

      {maps.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Seus mapas</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {maps.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-ink">{m.disease}</p>
                {m.area && <p className="text-xs text-muted">{m.area}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
