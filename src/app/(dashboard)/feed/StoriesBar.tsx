'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StoryGroup } from '@/lib/social/stories'
import { StoryViewer } from './StoryViewer'

type Draft = { file: File; url: string; isVideo: boolean }

export function StoriesBar({ groups, myInitials, myAvatar }: { groups: StoryGroup[]; myInitials: string; myAvatar: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [caption, setCaption] = useState('')
  const [capPos, setCapPos] = useState({ x: 0.5, y: 0.72 })
  const [capScale, setCapScale] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  function moveCaption(clientX: number, clientY: number) {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    setCapPos({ x, y })
  }

  async function onPick(file: File) {
    setErr(null)
    const isVideo = file.type.startsWith('video/')
    if (isVideo) {
      // valida duração ≤ 60s
      const dur = await new Promise<number>(resolve => {
        const v = document.createElement('video')
        v.preload = 'metadata'
        v.onloadedmetadata = () => resolve(v.duration)
        v.onerror = () => resolve(0)
        v.src = URL.createObjectURL(file)
      })
      if (dur > 61) { setErr('Vídeo de no máximo 1 minuto.'); return }
    }
    setDraft({ file, url: URL.createObjectURL(file), isVideo })
    setCaption('')
  }

  async function publish() {
    if (!draft || busy) return
    setBusy(true); setErr(null)
    try {
      const up = await fetch('/api/posts/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: draft.file.type }) })
      if (!up.ok) { setErr('Tipo de arquivo não suportado.'); return }
      const { uploadUrl, publicUrl } = await up.json()
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': draft.file.type, 'x-upsert': 'true' }, body: draft.file })
      if (!put.ok) { setErr('Falha no envio.'); return }
      const res = await fetch('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: draft.isVideo ? 'video' : 'image', mediaUrl: publicUrl, caption, captionX: caption ? capPos.x : null, captionY: caption ? capPos.y : null, captionScale: caption ? capScale : null }) })
      if (res.ok) { setDraft(null); router.refresh() } else setErr('Falha ao publicar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex gap-3 overflow-x-auto px-0.5 py-2">
      {/* adicionar */}
      <button onClick={() => fileRef.current?.click()} className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className="relative">
          <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-sm font-bold text-ink">
            {myAvatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={myAvatar} alt="" className="h-full w-full object-cover" /> : myInitials}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-sm font-bold leading-none text-primary-ink ring-2 ring-background">+</span>
        </span>
        <span className="truncate text-[11px] text-muted">Seu story</span>
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void onPick(f); e.target.value = '' }} />

      {groups.map((g, i) => (
        <button key={g.author.id} onClick={() => setViewing(i)} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-bold text-ink ring-2 ring-primary ring-offset-2 ring-offset-background">
            {g.author.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={g.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : g.author.initials}
          </span>
          <span className="w-16 truncate text-center text-[11px] text-muted">{g.isOwn ? 'Você' : g.author.name}</span>
        </button>
      ))}

      {viewing !== null && <StoryViewer groups={groups} startGroup={viewing} onClose={() => { setViewing(null); router.refresh() }} />}

      {/* composer: preview + legenda */}
      {draft && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4">
          <button onClick={() => setDraft(null)} className="self-end text-2xl leading-none text-white/80" aria-label="Fechar">×</button>
          <div ref={stageRef} className="relative flex flex-1 touch-none items-center justify-center overflow-hidden"
            onPointerMove={e => { if (draggingRef.current) moveCaption(e.clientX, e.clientY) }}
            onPointerUp={() => { draggingRef.current = false }}
          >
            {draft.isVideo
              ? <video src={draft.url} autoPlay loop playsInline muted className="max-h-full max-w-full rounded-lg object-contain" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={draft.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />}
            {caption && (
              <p
                onPointerDown={e => { draggingRef.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }}
                className="absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 cursor-move touch-none select-none px-2 text-center font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]"
                style={{ left: `${capPos.x * 100}%`, top: `${capPos.y * 100}%`, fontSize: `${1.125 * capScale}rem` }}
              >{caption}</p>
            )}
            {caption && (
              <input type="range" min={0.6} max={2.6} step={0.1} value={capScale} onChange={e => setCapScale(Number(e.target.value))}
                aria-label="Tamanho do texto"
                className="absolute right-2 top-1/2 h-40 -translate-y-1/2 [writing-mode:vertical-lr] [direction:rtl] accent-primary" />
            )}
          </div>
          <div className="mx-auto mt-3 w-full max-w-md space-y-2">
            {err && <p className="text-center text-xs text-danger">{err}</p>}
            {caption && <p className="text-center text-[11px] text-white/50">Arraste o texto para posicionar</p>}
            <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={200} placeholder="Escreva algo… 🙂 (emojis pelo teclado)" className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50" />
            <button onClick={publish} disabled={busy} className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Publicando…' : 'Publicar no story'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
