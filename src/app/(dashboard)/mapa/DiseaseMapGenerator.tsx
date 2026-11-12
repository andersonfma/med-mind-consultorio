'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { DiseaseMap } from '@/lib/disease-map/schema'
import { DiseaseMapView } from './DiseaseMapView'

const SUGGESTIONS = ['Insuficiência cardíaca', 'Cirrose hepática', 'Lúpus eritematoso sistêmico', 'DPOC', 'Cetoacidose diabética']

export function DiseaseMapGenerator() {
  const router = useRouter()
  const [disease, setDisease] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [premium, setPremium] = useState(false)
  const [map, setMap] = useState<DiseaseMap | null>(null)

  async function run(value: string) {
    const q = value.trim()
    if (!q || busy) return
    setBusy(true); setError(null); setPremium(false); setMap(null)
    try {
      const res = await fetch('/api/disease-map/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disease: q }),
      })
      const data = await res.json().catch(() => ({})) as { map?: DiseaseMap; error?: string; message?: string }
      if (res.ok && data.map) { setMap(data.map); router.refresh(); return } // refresh atualiza a lista salva
      if (res.status === 403) { setPremium(true); return }
      setError(data.message ?? 'Não foi possível gerar. Tente de novo.')
    } catch { setError('Erro de conexão.') } finally { setBusy(false) }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); run(disease) }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={disease} onChange={(e) => setDisease(e.target.value)}
            placeholder="Digite uma doença… (ex.: Insuficiência cardíaca)"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button type="submit" disabled={busy || !disease.trim()}
            className="rounded-xl px-6 py-3 text-sm font-bold text-[#1a1203] disabled:opacity-50" style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>
            {busy ? 'Gerando…' : 'Gerar mapa'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button type="button" key={s} onClick={() => { setDisease(s); run(s) }} disabled={busy}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-ink disabled:opacity-50">{s}</button>
          ))}
        </div>
      </form>

      {premium && (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#E7B23A66', background: 'rgba(231,178,58,.08)' }}>
          <p className="text-sm font-semibold text-ink">Você já usou seu mapa grátis.</p>
          <p className="mt-1 text-xs text-muted">Assine o Premium para gerar mapas ilimitados.</p>
          <Link href="/premium" className="mt-3 inline-block rounded-lg px-4 py-2 text-xs font-bold text-[#1a1203]" style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>Seja Premium</Link>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {map && <DiseaseMapView map={map} />}
    </div>
  )
}
