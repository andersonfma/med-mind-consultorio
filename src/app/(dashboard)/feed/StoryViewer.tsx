'use client'
import { useEffect, useState } from 'react'
import { shareCardRoute } from '@/lib/routes'
import { relativeTime } from '@/lib/social/time'
import type { StoryGroup } from '@/lib/social/stories'

const DURATION = 5000

export function StoryViewer({ groups, startGroup, onClose }: { groups: StoryGroup[]; startGroup: number; onClose: () => void }) {
  const [gi, setGi] = useState(startGroup)
  const [si, setSi] = useState(0)
  const group = groups[gi]
  const story = group?.stories[si]

  function next() {
    if (!group) return onClose()
    if (si + 1 < group.stories.length) { setSi(si + 1); return }
    if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); return }
    onClose()
  }
  function prev() {
    if (si > 0) { setSi(si - 1); return }
    if (gi > 0) { const pg = gi - 1; setGi(pg); setSi(groups[pg].stories.length - 1); return }
  }

  const isVideo = story?.kind === 'video'

  // auto-avanço (imagem/card: 5s; vídeo avança no onEnded) + Esc
  useEffect(() => {
    const t = isVideo ? null : setTimeout(next, DURATION)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev() }
    window.addEventListener('keydown', onKey)
    return () => { if (t) clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!group || !story) return null
  const src = isVideo ? (story.mediaUrl ?? '')
    : story.kind === 'image' ? (story.mediaUrl ?? '')
    : shareCardRoute(story.consultationId ?? '')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* barras de progresso */}
      <div className="flex gap-1 p-2">
        {group.stories.map((_, i) => (
          <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <span className={`block h-full bg-white ${i < si ? 'w-full' : i === si ? 'w-full animate-[storybar_5s_linear]' : 'w-0'}`} />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 pb-2">
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white/15 text-xs font-bold text-white">
          {group.author.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={group.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : group.author.initials}
        </span>
        <span className="text-sm font-semibold text-white">{group.author.name}</span>
        <span className="text-xs text-white/70">· {relativeTime(story.createdAt)}</span>
        <button onClick={onClose} className="ml-auto text-2xl leading-none text-white/80" aria-label="Fechar">×</button>
      </div>

      <div className="relative flex-1">
        {isVideo ? (
          <video src={src} autoPlay playsInline onEnded={next} className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
        )}
        {story.caption && (
          story.captionX != null && story.captionY != null ? (
            <p className="pointer-events-none absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 px-2 text-center text-base font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" style={{ left: `${story.captionX * 100}%`, top: `${story.captionY * 100}%` }}>{story.caption}</p>
          ) : (
            <p className="pointer-events-none absolute bottom-10 left-0 right-0 px-6 text-center text-base font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">{story.caption}</p>
          )
        )}
        {/* zonas de toque: esquerda=voltar, direita=avançar */}
        <button onClick={prev} className="absolute inset-y-0 left-0 w-1/3" aria-label="Anterior" />
        <button onClick={next} className="absolute inset-y-0 right-0 w-2/3" aria-label="Próximo" />
      </div>

      <style>{`@keyframes storybar { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  )
}
