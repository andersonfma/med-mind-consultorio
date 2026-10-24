'use client'
import { useState, useEffect } from 'react'

const KEY = 'mm_consult_guide_dismissed'

// Guia de conclusão (onboarding): ensina o caminho até a avaliação e antecipa a recompensa.
// Dispensável (localStorage), para não incomodar quem já domina o fluxo.
export function ConsultationGuide({ steps }: { steps: { label: string; done: boolean }[] }) {
  const [hidden, setHidden] = useState(true)
  useEffect(() => { setHidden(localStorage.getItem(KEY) === '1') }, [])
  if (hidden) return null

  const allDone = steps.every((s) => s.done)
  return (
    <div className="flex items-start gap-3 border-b border-primary/20 bg-primary/5 px-3 sm:px-4 py-2 text-xs shrink-0">
      <span className="shrink-0 text-base leading-none">🎯</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {allDone ? 'Tudo pronto — clique “Finalizar” para ver sua avaliação.' : 'Como concluir e ver sua avaliação'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {steps.map((s, i) => (
            <span key={i} className={s.done ? 'text-success' : 'text-muted'}>
              {s.done ? '✓' : '○'} {s.label}
            </span>
          ))}
          <span className="font-semibold text-ink">→ Finalizar</span>
        </div>
        <p className="mt-1 text-muted">Ao finalizar você recebe a <span className="text-ink">nota do seu raciocínio</span>, o radar de performance e um card pra compartilhar.</p>
      </div>
      <button
        onClick={() => { localStorage.setItem(KEY, '1'); setHidden(true) }}
        aria-label="Dispensar guia"
        className="shrink-0 text-base leading-none text-muted hover:text-ink"
      >
        ×
      </button>
    </div>
  )
}
