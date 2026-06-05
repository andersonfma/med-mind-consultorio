'use client'
import { useState, useEffect, useRef } from 'react'

type Props = {
  consultationId: string
  initialValue: string
}

export function ClinicalReasoningField({ consultationId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue)
  const [saved, setSaved] = useState(true)
  const lastSavedRef = useRef(initialValue)

  useEffect(() => {
    const interval = setInterval(async () => {
      if (value === lastSavedRef.current) return
      try {
        const res = await fetch(`/api/consultations/${consultationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinical_reasoning: value }),
        })
        if (!res.ok) throw new Error('save failed')
        lastSavedRef.current = value
        setSaved(true)
      } catch {
        // Silently fail — will retry in 30s
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [consultationId, value])

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">PENSAMENTO CLÍNICO</p>
        <span className="text-xs text-gray-400">{saved ? 'Salvo' : 'Não salvo'}</span>
      </div>
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        placeholder="Registre seu raciocínio diagnóstico..."
        className="flex-1 border border-gray-200 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    </div>
  )
}
