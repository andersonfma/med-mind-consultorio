'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SPECIALTIES, DIFFICULTIES } from '@/lib/patients/specialties'
import type { Specialty, Difficulty } from '@/lib/patients/specialties'
import { patientDetailRoute } from '@/lib/routes'

export function NewPatientForm() {
  const router = useRouter()
  const [specialty, setSpecialty] = useState<Specialty | ''>('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!specialty || !difficulty) return
    setLoading(true)
    setFormError(null)

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, difficulty }),
      })

      if (response.status === 201) {
        const data = await response.json()
        if (!data?.id) {
          setFormError('Resposta inválida do servidor')
          return
        }
        router.push(patientDetailRoute(data.id))
      } else {
        const json = await response.json()
        setFormError(json?.error ?? 'Erro desconhecido')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Novo Paciente</h1>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="space-y-4">
        <div>
          <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
            Especialidade
          </label>
          <select
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value as Specialty)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Selecione...</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">
              Dificuldade
            </legend>
            <div className="flex gap-3">
              {([['easy', 'Fácil'], ['medium', 'Médio'], ['hard', 'Difícil']] as const).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    className={`px-4 py-2 text-sm rounded-md border ${
                      difficulty === value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </fieldset>
        </div>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <button
          type="submit"
          disabled={loading || !specialty || !difficulty}
          className="w-full btn btn--primary"
        >
          {loading ? 'Aguardando...' : 'Confirmar'}
        </button>
      </form>
    </div>
  )
}
