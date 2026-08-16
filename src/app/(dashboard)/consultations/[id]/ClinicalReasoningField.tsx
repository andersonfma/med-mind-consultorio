'use client'
import { useState, useEffect, useRef } from 'react'
import { MicButton } from './MicButton'
import { appendTranscript } from '@/lib/audio/transcribe-client'

type Props = {
  consultationId: string
  value: string
  onChange: (value: string) => void
}

export function ClinicalReasoningField({ consultationId, value, onChange }: Props) {
  const [saved, setSaved] = useState(true)
  const lastSavedRef = useRef(value)
  // O hook useVoiceDictation congela o closure onTranscript no início da
  // gravação (recorder.onstop é montado dentro de start()). Este ref sempre
  // aponta para o valor ATUAL do campo, para que o append use o texto digitado
  // durante a gravação em vez do texto congelado no início dela.
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  // Autosave com DEBOUNCE: salva ~1,2s depois que o aluno para de digitar e marca "Salvo".
  // (Antes era um intervalo de 30s que reiniciava a cada tecla — o indicador ficava preso em "Não salvo".)
  useEffect(() => {
    if (value === lastSavedRef.current) {
      setSaved(true)
      return
    }
    setSaved(false)
    const timeout = setTimeout(async () => {
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
        // Falha silenciosa — nova tentativa na próxima alteração; o finish também persiste o texto.
      }
    }, 1200)
    return () => clearTimeout(timeout)
  }, [consultationId, value])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-0 mb-1">
        <MicButton onTranscript={(t) => { onChange(appendTranscript(valueRef.current, t)); setSaved(false) }} />
        <span className="text-xs text-muted">{saved ? 'Salvo' : 'Não salvo'}</span>
      </div>
      <textarea
        value={value}
        onChange={e => { onChange(e.target.value); setSaved(false) }}
        placeholder="Registre seu raciocínio diagnóstico..."
        className="flex-1 bg-surface-2 text-ink placeholder:text-muted border border-border rounded-md p-3 text-sm resize-none focus:outline-none focus:border-primary"
      />
    </div>
  )
}
