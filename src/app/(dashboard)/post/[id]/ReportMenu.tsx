'use client'
import { useState } from 'react'

export function ReportMenu({ targetType, targetId }: { targetType: 'post' | 'comment'; targetId: string }) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function report() {
    if (busy || done) return
    setBusy(true)
    try {
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, targetId, reason: 'denúncia do usuário' }) })
      if (res.ok) setDone(true)
    } finally { setBusy(false) }
  }
  return <button onClick={report} disabled={busy || done} title="Denunciar" className="text-xs text-muted hover:text-danger">{done ? 'denunciado' : '⚑'}</button>
}
