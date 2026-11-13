import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { DiseaseMapGenerator } from './DiseaseMapGenerator'

export const dynamic = 'force-dynamic'

type SavedMap = { id: string; disease: string; area: string | null; created_at: string }

export default async function MapaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  const { data: saved } = await db
    .from('disease_maps').select('id, disease, area, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)
  const rawMaps = (saved ?? []) as SavedMap[]

  // Catálogo: 1 entrada por doença (mantém a mais recente), agrupada por
  // especialidade e em ordem alfabética — para consultar sempre que precisar.
  const seen = new Set<string>()
  const maps = rawMaps.filter((m) => {
    const k = m.disease.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); return true
  })
  const byArea = new Map<string, SavedMap[]>()
  for (const m of maps) {
    const a = (m.area && m.area.trim()) || 'Outros'
    const arr = byArea.get(a)
    if (arr) arr.push(m); else byArea.set(a, [m])
  }
  const areas = [...byArea.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  for (const a of areas) byArea.get(a)!.sort((x, y) => x.disease.localeCompare(y.disease, 'pt-BR'))

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Mapa da Doença</h1>
        <p className="mt-2 max-w-xl text-muted">Entenda a doença pela fisiopatogênese — e veja a clínica, o diagnóstico e o tratamento saírem do mecanismo. Digite uma doença e gere o mapa.</p>
      </header>

      <DiseaseMapGenerator />

      {maps.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Seu catálogo · {maps.length} {maps.length === 1 ? 'mapa' : 'mapas'}
          </h2>
          {areas.map((area) => (
            <div key={area}>
              <h3 className="mb-2 text-[13px] font-bold text-ink">{area}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {byArea.get(area)!.map((m) => (
                  <Link key={m.id} href={`/mapa/${m.id}`}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-primary">
                    <span className="text-sm font-semibold text-ink">{m.disease}</span>
                    <span className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
