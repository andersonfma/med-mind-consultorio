'use client'
import { useState, useEffect } from 'react'
import { searchCatalog } from '@/lib/prescriptions/catalog'
import type { Specialty } from '@/lib/patients/specialties'
import type { Prescription, ConductKind } from '@/lib/prescriptions/types'

type Props = {
  consultationId: string
  specialty: Specialty
  activeMedications?: Array<{ drug_name: string; posology: string }>
  onStatus?: (count: number) => void
}

const ADEQUACY_STYLE: Record<string, string> = {
  adequada: 'bg-success/15 text-success',
  parcial: 'bg-warning/15 text-warning',
  inadequada: 'bg-danger/15 text-danger',
}

export function PrescriptionPanel({ consultationId, specialty, activeMedications = [], onStatus }: Props) {
  const [items, setItems] = useState<Prescription[]>([])
  const [drug, setDrug] = useState('')
  const [posology, setPosology] = useState('')
  const [justification, setJustification] = useState('')
  const [source, setSource] = useState<'catalog' | 'free'>('free')
  const [kind, setKind] = useState<ConductKind>('medicamento')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSug, setShowSug] = useState(false)

  useEffect(() => {
    fetch(`/api/consultations/${consultationId}/prescriptions`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setError('Erro ao carregar prescrições.'))
  }, [consultationId])

  useEffect(() => {
    onStatus?.(items.length)
  }, [items, onStatus])

  const suggestions = drug.length > 1 ? searchCatalog(specialty, drug) : []

  async function prescribe() {
    if (!drug.trim() || !posology.trim() || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/prescriptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug_name: drug.trim(), posology: posology.trim(), justification: justification.trim() || undefined, source, kind }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao prescrever'); return }
      setItems(prev => [...prev, data as Prescription])
      setDrug(''); setPosology(''); setJustification(''); setSource('free'); setKind('medicamento')
    } catch { setError('Erro de conexão.') } finally { setLoading(false) }
  }

  async function suspend(id: string) {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/prescriptions/${id}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      setItems(prev => prev.map(p => p.id === id ? { ...p, status: 'suspended' } : p))
    } catch { setError('Erro de conexão.') } finally { setLoading(false) }
  }

  return (
    <div className="p-3 space-y-3">
      {activeMedications.length > 0 && (
        <div className="rounded-lg bg-surface-2 border border-border p-3 space-y-1">
          <p className="text-xs font-semibold text-chart-3 uppercase tracking-wide">Medicações em uso</p>
          {activeMedications.map((m, i) => (
            <p key={i} className="text-xs text-muted"><span className="font-medium text-ink">{m.drug_name}</span> — {m.posology}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-1">
          {(['medicamento', 'procedimento', 'medida'] as ConductKind[]).map(k => (
            <button key={k} type="button"
              onClick={() => setKind(k)}
              className={`text-xs px-2 py-1 rounded-md capitalize transition-colors ${kind === k ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-muted hover:text-ink'}`}>
              {k}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text" value={drug}
            onChange={e => { setDrug(e.target.value); setShowSug(true); setSource('free') }}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder={kind === 'medicamento' ? 'Medicamento...' : kind === 'procedimento' ? 'Procedimento...' : 'Medida...'}
            maxLength={300}
            className="w-full bg-surface-2 text-ink placeholder:text-muted border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
          />
          {kind === 'medicamento' && showSug && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-surface-2 border border-border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <li key={s.name}
                  onMouseDown={() => { setDrug(s.name); setPosology(s.posology); setSource('catalog'); setShowSug(false) }}
                  className="px-3 py-1.5 text-sm text-ink cursor-pointer hover:bg-surface">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">{s.indication} · {s.posology}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="text" value={posology}
          onChange={e => setPosology(e.target.value)}
          placeholder={kind === 'medicamento' ? 'Posologia (dose, via, frequência, duração)...' : 'Detalhamento...'}
          maxLength={1000}
          className="w-full bg-surface-2 text-ink placeholder:text-muted border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
        />
        <textarea
          value={justification} onChange={e => setJustification(e.target.value)}
          placeholder="Justificativa (opcional)..." rows={2} maxLength={2000}
          className="w-full bg-surface-2 text-ink placeholder:text-muted border border-border rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-primary"
        />
        {error && <p className="text-danger text-xs">{error}</p>}
        <button onClick={prescribe} disabled={loading || !drug.trim() || !posology.trim()}
          className="w-full text-xs bg-surface-2 border border-border hover:bg-surface hover:border-border-strong rounded-md py-1.5 text-ink font-medium transition-colors disabled:opacity-50">
          {loading ? 'Prescrevendo...' : '+ Prescrever'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(rx => (
            <div key={rx.id} className={`rounded-md px-3 py-2 text-sm border border-border ${rx.status === 'suspended' ? 'bg-surface-2 opacity-60' : 'bg-surface-2'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink">
                  {rx.kind !== 'medicamento' && <span className="text-muted mr-1">[{rx.kind}]</span>}
                  {rx.drug_name}{rx.status === 'suspended' && ' (suspenso)'}
                </span>
                {rx.adequacy && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ADEQUACY_STYLE[rx.adequacy] ?? 'bg-surface text-muted'}`}>
                    {rx.adequacy}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">{rx.posology}</p>
              {rx.ai_feedback && <p className="text-xs text-muted mt-0.5 leading-tight">{rx.ai_feedback}</p>}
              {rx.status === 'active' && (
                <button onClick={() => suspend(rx.id)} className="text-xs text-primary hover:underline mt-1">Suspender</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
