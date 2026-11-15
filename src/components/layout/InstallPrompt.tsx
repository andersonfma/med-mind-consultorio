'use client'
import { useEffect, useState } from 'react'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const DISMISS_KEY = 'mm-install-dismissed'
const DISMISS_MS = 14 * 86_400_000

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type Mode = 'none' | 'ios-install' | 'android-install' | 'enable-push'

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>('none')
  const [busy, setBusy] = useState(false)
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const d = localStorage.getItem(DISMISS_KEY)
      if (d && Date.now() - Number(d) < DISMISS_MS) return
    } catch { /* ignore */ }

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true

    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID
    const offerPushIfPending = () => {
      if (!canPush || Notification.permission !== 'default') return
      navigator.serviceWorker.getRegistration()
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub) => { if (!sub) setMode((m) => (m === 'none' ? 'enable-push' : m)) })
        .catch(() => {})
    }

    if (standalone) { offerPushIfPending(); return }

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
    if (isIOS && isSafari) { setMode('ios-install'); return }

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setMode('android-install') }
    window.addEventListener('beforeinstallprompt', onBIP)
    offerPushIfPending()
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setMode('none')
  }

  async function install() {
    if (!deferred) return
    try { await deferred.prompt(); await deferred.userChoice } catch { /* cancelado */ }
    dismiss()
  }

  async function enablePush() {
    if (busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { dismiss(); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) as unknown as BufferSource })
      const j = sub.toJSON()
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }) })
    } catch { /* ignore */ } finally { setBusy(false); setMode('none') }
  }

  if (mode === 'none') return null

  const GOLD = '#E7B23A'
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border p-3.5 sm:items-center"
      style={{ borderColor: `${GOLD}44`, background: 'rgba(231,178,58,.06)' }}>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:mt-0" style={{ background: `${GOLD}1f`, color: GOLD }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        {mode === 'ios-install' && (
          <p className="text-sm text-ink">
            <b>Instale o Med Mind no seu iPhone</b> para receber os avisos do Desafio: toque em <b>Compartilhar</b> e depois em <b>&ldquo;Adicionar à Tela de Início&rdquo;</b>.
          </p>
        )}
        {mode === 'android-install' && (
          <p className="text-sm text-ink"><b>Instale o Med Mind</b> no seu aparelho — acesso rápido e os avisos do Desafio no celular.</p>
        )}
        {mode === 'enable-push' && (
          <p className="text-sm text-ink"><b>Ative os avisos</b> do Desafio da Semana e da sua sequência neste aparelho.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {mode === 'android-install' && (
          <button onClick={install} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#1a1203]" style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>Instalar</button>
        )}
        {mode === 'enable-push' && (
          <button onClick={enablePush} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#1a1203] disabled:opacity-60" style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>{busy ? 'Ativando…' : 'Ativar'}</button>
        )}
        <button onClick={dismiss} aria-label="Dispensar" className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:text-ink">Agora não</button>
      </div>
    </div>
  )
}
