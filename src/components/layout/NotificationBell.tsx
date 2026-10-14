'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { postRoute, profileRoute } from '@/lib/routes'
import { relativeTime } from '@/lib/social/time'

type Item = { id: string; type: string; postId: string | null; read: boolean; createdAt: string; actorName: string; actorInitials: string; actorAvatar: string | null; actorHandle: string | null }

function textFor(it: Item): string {
  switch (it.type) {
    case 'like': return `${it.actorName} curtiu seu post`
    case 'comment': return `${it.actorName} comentou no seu post`
    case 'follow': return `${it.actorName} começou a te seguir`
    case 'doubt_answer': return `Você ganhou MedCoin por responder a dúvida de ${it.actorName}`
    default: return 'Nova atividade'
  }
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) { const j = await res.json(); setItems(j.items as Item[]); setUnread(j.unread as number) }
    } catch { /* silencioso */ }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // fecha ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      try { await fetch('/api/notifications', { method: 'POST' }) } catch { /* silencioso */ }
    }
  }

  function go(it: Item) {
    setOpen(false)
    if (it.postId) router.push(postRoute(it.postId))
    else if (it.type === 'follow' && it.actorHandle) router.push(profileRoute(it.actorHandle))
  }

  return (
    <div ref={boxRef} className="relative">
      <button onClick={toggle} aria-label="Notificações" className="relative grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-ink">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-80 max-w-[85vw] overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-ink">Notificações</p>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Nada por aqui ainda.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map(it => (
                <li key={it.id}>
                  <button onClick={() => go(it)} className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/50 ${it.read ? '' : 'bg-primary/5'}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[11px] font-bold text-ink">
                      {it.actorAvatar
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.actorAvatar} alt="" className="h-full w-full object-cover" /> : it.actorInitials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{textFor(it)}</span>
                      <span className="text-[11px] text-muted">{relativeTime(it.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
