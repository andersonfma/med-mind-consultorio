'use client'
import { useEffect, useState } from 'react'
import { useVoiceDictation, isDictationSupported } from '@/lib/audio/useVoiceDictation'

type Props = { onTranscript: (text: string) => void; disabled?: boolean }

export function MicButton({ onTranscript, disabled }: Props) {
  const { state, error, start, stop } = useVoiceDictation(onTranscript)
  // Evita mismatch de hidratação: no servidor isDictationSupported() é sempre
  // false (sem window), mas no cliente pode ser true — renderizar diferente
  // no primeiro paint do cliente gera warning de hydration. Mantém os dois
  // primeiros renders (SSR e 1º cliente) idênticos (null) e só revela o botão
  // depois de montar. O hook continua sendo chamado incondicionalmente antes
  // de qualquer return, respeitando as Rules of Hooks.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || !isDictationSupported()) return null

  const recording = state === 'recording'
  const transcribing = state === 'transcribing'
  const label = transcribing ? 'transcrevendo…' : recording ? 'gravando…' : 'ditar'

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : start())}
      disabled={disabled || transcribing}
      title={error ?? label}
      aria-label={label}
      className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
        recording ? 'bg-red-100 text-red-600 animate-pulse'
        : transcribing ? 'bg-gray-100 text-gray-400'
        : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <span aria-hidden>🎤</span>
      <span>{label}</span>
    </button>
  )
}
