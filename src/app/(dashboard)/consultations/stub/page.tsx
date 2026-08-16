import Link from 'next/link'
import { DASHBOARD_ROUTE } from '@/lib/routes'

export default function StubPage() {
  return (
    <div className="p-8 text-center">
      <h1 className="font-display text-xl font-semibold text-ink mb-2">
        Consulta em breve
      </h1>
      <p className="text-muted mb-6">Funcionalidade em desenvolvimento.</p>
      <Link href={DASHBOARD_ROUTE} className="inline-flex items-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface hover:border-border-strong">
        Voltar
      </Link>
    </div>
  )
}
