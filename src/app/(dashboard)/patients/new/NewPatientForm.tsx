'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SPECIALTIES } from '@/lib/patients/specialties'
import type { Specialty, Difficulty } from '@/lib/patients/specialties'
import { diseaseSuggestions } from '@/lib/patients/diseases'
import { patientDetailRoute } from '@/lib/routes'

type Mode = 'specialty' | 'disease'

export function NewPatientForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('specialty')
  const [specialty, setSpecialty] = useState<Specialty | ''>('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [disease, setDisease] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const suggestions = specialty ? diseaseSuggestions(specialty as Specialty, disease) : []
  const canSubmit = !!specialty && !!difficulty && (mode === 'specialty' || !!disease.trim())

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setFormError(null)
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialty,
          difficulty,
          ...(mode === 'disease' && disease.trim() ? { disease: disease.trim() } : {}),
        }),
      })
      if (response.status === 201) {
        const data = await response.json()
        if (!data?.id) { setFormError('Resposta inválida do servidor'); return }
        router.push(patientDetailRoute(data.id))
      } else {
        const json = await response.json()
        setFormError(json?.error ?? 'Erro desconhecido')
      }
    } finally {
      setLoading(false)
    }
  }

  const modeBtn = (m: Mode, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
        mode === m ? 'border-primary bg-primary/10' : 'border-border bg-surface-2 hover:border-border-strong'
      }`}
    >
      <span className={`block text-sm font-semibold ${mode === m ? 'text-primary' : 'text-ink'}`}>{label}</span>
      <span className="mt-0.5 block text-xs text-muted">{sub}</span>
    </button>
  )

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="font-display text-xl font-bold text-ink mb-5">Novo paciente</h1>

      {/* Modo */}
      <div className="flex gap-2 mb-5">
        {modeBtn('specialty', 'Por especialidade', 'Diagnóstico surpresa')}
        {modeBtn('disease', 'Por doença', 'Você escolhe o tema')}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-4">
        <div>
          <label htmlFor="specialty" className="block text-sm font-medium text-muted mb-1">Especialidade</label>
          <select
            id="specialty"
            value={specialty}
            onChange={(e) => { setSpecialty(e.target.value as Specialty); setDisease('') }}
            className="w-full bg-surface-2 text-ink border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary"
          >
            <option value="">Selecione...</option>
            {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {mode === 'disease' && (
          <div>
            <label htmlFor="disease" className="block text-sm font-medium text-muted mb-1">Doença / tema</label>
            <div className="relative">
              <input
                id="disease"
                type="text"
                value={disease}
                disabled={!specialty}
                onChange={(e) => { setDisease(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder={specialty ? 'Busque ou digite a doença...' : 'Selecione a especialidade primeiro'}
                className="w-full bg-surface-2 text-ink placeholder:text-muted border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-surface-2 border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <li
                      key={s}
                      onMouseDown={() => { setDisease(s); setShowSuggestions(false) }}
                      className="px-3 py-1.5 text-sm text-ink cursor-pointer hover:bg-surface"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Sugestões aparecem ao digitar; você também pode escrever outra doença.</p>
          </div>
        )}

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-muted mb-1">Dificuldade</legend>
            <div className="flex gap-3">
              {([['easy', 'Fácil'], ['medium', 'Médio'], ['hard', 'Difícil']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDifficulty(value)}
                  className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                    difficulty === value
                      ? 'bg-primary text-primary-ink border-primary'
                      : 'bg-surface-2 text-muted border-border hover:border-border-strong hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'disease' && (
              <p className="mt-1.5 text-xs text-muted">No modo doença, a dificuldade varia a apresentação: fácil = clássica · difícil = atípica/enganosa.</p>
            )}
          </fieldset>
        </div>

        {formError && <p className="text-danger text-sm">{formError}</p>}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Gerando caso...' : 'Gerar paciente'}
        </button>
      </form>
    </div>
  )
}
