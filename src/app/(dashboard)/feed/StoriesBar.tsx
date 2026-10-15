'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StoryGroup } from '@/lib/social/stories'
import { StoryViewer } from './StoryViewer'

export function StoriesBar({ groups, myInitials, myAvatar }: { groups: StoryGroup[]; myInitials: string; myAvatar: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function addImage(file: File) {
    if (busy) return
    setBusy(true)
    try {
      const up = await fetch('/api/posts/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) })
      if (!up.ok) return
      const { uploadUrl, publicUrl } = await up.json()
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file })
      if (!put.ok) return
      const res = await fetch('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'image', mediaUrl: publicUrl }) })
      if (res.ok) router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {/* adicionar */}
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-2 text-sm font-bold text-ink">
          {myAvatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={myAvatar} alt="" className="h-full w-full object-cover" /> : myInitials}
          <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-ink">+</span>
        </span>
        <span className="truncate text-[11px] text-muted">{busy ? '…' : 'Seu story'}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void addImage(f) }} />

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
    </div>
  )
}
