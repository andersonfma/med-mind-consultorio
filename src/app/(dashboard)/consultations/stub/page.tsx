import Link from 'next/link'
import { DASHBOARD_ROUTE } from '@/lib/routes'

export default function StubPage() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-semibold text-gray-700 mb-2">
        Consulta em breve
      </h1>
      <p className="text-gray-500 mb-6">Funcionalidade em desenvolvimento.</p>
      <Link href={DASHBOARD_ROUTE} className="btn btn--secondary">
        Voltar
      </Link>
    </div>
  )
}
