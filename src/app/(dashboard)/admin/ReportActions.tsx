'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function resolve(hide: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hide }),
      })
      if (res.ok) { setDone(true); router.refresh() }
    } finally { setBusy(false) }
  }

  if (done) return <span className="text-xs text-success">resolvida</span>
  return (
    <div className="flex shrink-0 gap-2">
      <button onClick={() => resolve(true)} disabled={busy} className="rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-50">
        Ocultar e resolver
      </button>
      <button onClick={() => resolve(false)} disabled={busy} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted disabled:opacity-50">
        Manter e resolver
      </button>
    </div>
  )
}
