'use client'
import { useEffect, useState } from 'react'
import { useVoiceDictation, isDictationSupported } from '@/lib/audio/useVoiceDictation'

type Props = { onTranscript: (text: string) => void; disabled?: boolean }

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" />
    </svg>
  )
}

export function MicButton({ onTranscript, disabled }: Props) {
  const { state, error, start, stop } = useVoiceDictation(onTranscript)
  // Evita mismatch de hidratação: no servidor isDictationSupported() é sempre
  // false (sem window), mas no cliente pode ser true. Mantém os dois primeiros
  // renders (SSR e 1º cliente) idênticos (null) e só revela o botão depois de
  // montar. O hook continua sendo chamado incondicionalmente antes de qualquer
  // return, respeitando as Rules of Hooks.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Cronômetro da gravação (mm:ss). Zera fora do estado 'recording'.
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (state !== 'recording') { setSecs(0); return }
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  if (!mounted || !isDictationSupported()) return null

  const recording = state === 'recording'
  const transcribing = state === 'transcribing'
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  const label = transcribing ? 'Transcrevendo…' : recording ? 'Ouvindo…' : 'Falar'

  const tone = recording
    ? 'bg-danger/15 text-danger border-danger'
    : transcribing
      ? 'bg-surface-2 text-primary border-primary cursor-progress'
      : 'bg-surface-2 text-muted border-border hover:border-primary hover:text-primary'

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : start())}
      disabled={disabled || transcribing}
      title={error ?? (recording ? 'Toque para parar' : 'Ditado por voz')}
      aria-label={error ?? label}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${tone}`}
    >
      {transcribing ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <MicIcon />
      )}
      {recording && (
        <span className="flex items-end gap-0.5" aria-hidden>
          <span className="w-1 h-1.5 rounded-full bg-current animate-pulse motion-reduce:animate-none" />
          <span className="w-1 h-2.5 rounded-full bg-current animate-pulse [animation-delay:150ms] motion-reduce:animate-none" />
          <span className="w-1 h-2 rounded-full bg-current animate-pulse [animation-delay:300ms] motion-reduce:animate-none" />
        </span>
      )}
      <span>{label}</span>
      {recording && <span className="font-mono tabular-nums text-xs opacity-80">{mmss}</span>}
    </button>
  )
}
