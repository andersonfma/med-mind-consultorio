'use client'
import { useState, useEffect, useRef } from 'react'

type Props = {
  consultationId: string
  value: string
  onChange: (value: string) => void
}

export function ClinicalReasoningField({ consultationId, value, onChange }: Props) {
  const [saved, setSaved] = useState(true)
  const lastSavedRef = useRef(value)

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
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-0 mb-1">
        <span className="text-xs text-gray-400">{saved ? 'Salvo' : 'Não salvo'}</span>
      </div>
      <textarea
        value={value}
        onChange={e => { onChange(e.target.value); setSaved(false) }}
        placeholder="Registre seu raciocínio diagnóstico..."
        className="flex-1 border border-gray-200 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    </div>
  )
}
