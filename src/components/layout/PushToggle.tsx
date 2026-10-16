'use client'
import { useEffect, useState } from 'react'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied'

export function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID) { setState('unsupported'); return }
    if (Notification.permission === 'denied') { setState('denied'); return }
    navigator.serviceWorker.getRegistration().then(reg => reg?.pushManager.getSubscription()).then(sub => setState(sub ? 'on' : 'off')).catch(() => setState('off'))
  }, [])

  async function enable() {
    if (busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) as unknown as BufferSource })
      const j = sub.toJSON()
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }) })
      setState(res.ok ? 'on' : 'off')
    } catch { setState('off') } finally { setBusy(false) }
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
      setState('off')
    } finally { setBusy(false) }
  }

  if (state === 'loading' || state === 'unsupported') return null
  return (
    <div className="border-b border-border px-4 py-2 text-xs">
      {state === 'denied' ? (
        <span className="text-muted">Notificações bloqueadas no navegador. Ative nas configurações do site.</span>
      ) : state === 'on' ? (
        <button onClick={disable} disabled={busy} className="font-medium text-muted hover:text-ink">🔔 Notificações ativadas · desativar</button>
      ) : (
        <button onClick={enable} disabled={busy} className="font-semibold text-primary">{busy ? 'Ativando…' : '🔔 Ativar notificações neste aparelho'}</button>
      )}
    </div>
  )
}
