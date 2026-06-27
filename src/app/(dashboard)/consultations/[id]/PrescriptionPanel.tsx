'use client'
import { useState, useEffect } from 'react'
import { searchCatalog } from '@/lib/prescriptions/catalog'
import type { Specialty } from '@/lib/patients/specialties'
import type { Prescription } from '@/lib/prescriptions/types'

type Props = {
  consultationId: string
  specialty: Specialty
  activeMedications?: Array<{ drug_name: string; posology: string }>
}

const ADEQUACY_STYLE: Record<string, string> = {
  adequada: 'bg-green-100 text-green-700',
  parcial: 'bg-yellow-100 text-yellow-700',
  inadequada: 'bg-red-100 text-red-600',
}

export function PrescriptionPanel({ consultationId, specialty, activeMedications = [] }: Props) {
  const [items, setItems] = useState<Prescription[]>([])
  const [drug, setDrug] = useState('')
  const [posology, setPosology] = useState('')
  const [justification, setJustification] = useState('')
  const [source, setSource] = useState<'catalog' | 'free'>('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSug, setShowSug] = useState(false)

  useEffect(() => {
    fetch(`/api/consultations/${consultationId}/prescriptions`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setError('Erro ao carregar prescrições.'))
  }, [consultationId])

  const suggestions = drug.length > 1 ? searchCatalog(specialty, drug) : []

  async function prescribe() {
    if (!drug.trim() || !posology.trim() || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/prescriptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug_name: drug.trim(), posology: posology.trim(), justification: justification.trim() || undefined, source }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao prescrever'); return }
      setItems(prev => [...prev, data as Prescription])
      setDrug(''); setPosology(''); setJustification(''); setSource('free')
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
        <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-1">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Medicações em uso</p>
          {activeMedications.map((m, i) => (
            <p key={i} className="text-xs text-gray-600"><span className="font-medium text-gray-800">{m.drug_name}</span> — {m.posology}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <input
            type="text" value={drug}
            onChange={e => { setDrug(e.target.value); setShowSug(true); setSource('free') }}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="Medicamento..."
            maxLength={300}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <li key={s.name}
                  onMouseDown={() => { setDrug(s.name); setPosology(s.posology); setSource('catalog'); setShowSug(false) }}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-gray-400">{s.indication} · {s.posology}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="text" value={posology}
          onChange={e => setPosology(e.target.value)}
          placeholder="Posologia (dose, via, frequência, duração)..."
          maxLength={1000}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <textarea
          value={justification} onChange={e => setJustification(e.target.value)}
          placeholder="Justificativa (opcional)..." rows={2} maxLength={2000}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button onClick={prescribe} disabled={loading || !drug.trim() || !posology.trim()}
          className="w-full text-xs bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 text-gray-600 font-medium">
          {loading ? 'Prescrevendo...' : '+ Prescrever'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(rx => (
            <div key={rx.id} className={`rounded-md px-3 py-2 text-sm ${rx.status === 'suspended' ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-800">
                  {rx.drug_name}{rx.status === 'suspended' && ' (suspenso)'}
                </span>
                {rx.adequacy && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ADEQUACY_STYLE[rx.adequacy] ?? 'bg-gray-100 text-gray-500'}`}>
                    {rx.adequacy}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{rx.posology}</p>
              {rx.ai_feedback && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{rx.ai_feedback}</p>}
              {rx.status === 'active' && (
                <button onClick={() => suspend(rx.id)} className="text-xs text-blue-500 hover:underline mt-1">Suspender</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
