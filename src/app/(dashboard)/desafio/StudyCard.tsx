'use client'
import { useState } from 'react'

type Point = { stage: string; text: string }

const APP_URL = 'https://app.medmindedu.com.br'

// Card de estudo do caso da semana — aparece ao concluir o desafio. Grátis e compartilhável.
export function StudyCard({ title, diagnosis, review, points }: {
  title: string; diagnosis: string; review: string; points: Point[]
}) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const lines = [
      `Resumo de estudo — ${title}`,
      `Diagnóstico: ${diagnosis}`,
      '',
      'Pontos-chave:',
      ...points.map((p) => `• ${p.stage}: ${p.text}`),
      '',
      `Estude o caso da semana no Med Mind: ${APP_URL}`,
    ]
    const text = lines.join('\n')
    try {
      if (navigator.share) { await navigator.share({ title: 'Resumo de estudo — Med Mind', text }); return }
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    } catch { /* usuário cancelou */ }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/[0.07] to-transparent p-5">
      <span className="absolute left-0 top-0 h-full w-[3px]" aria-hidden
        style={{ background: 'linear-gradient(to bottom,#22E0E6,transparent 85%)' }} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Resumo de estudo</p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">Caso concluído</span>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-3.5">
        <p className="font-mono text-[10.5px] uppercase tracking-wide text-muted">Diagnóstico</p>
        <p className="mt-0.5 font-display text-lg font-bold text-ink">{diagnosis}</p>
      </div>

      {points.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-muted">Pontos-chave do caso</p>
          <ul className="space-y-2.5">
            {points.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <p className="text-sm text-ink"><span className="font-semibold text-primary">{p.stage}:</span> {p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review && (
        <div className="mt-4">
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-muted">Revisão</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{review}</p>
        </div>
      )}

      <button onClick={share}
        className="btn-electric mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
        {copied ? 'Resumo copiado!' : 'Compartilhar resumo de estudo'}
      </button>
    </section>
  )
}
