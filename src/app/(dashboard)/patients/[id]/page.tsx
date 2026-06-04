import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, STUB_CONSULTATION_ROUTE } from '@/lib/routes'
import { BondBar } from '@/components/ui/BondBar'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { id } = await params

  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !patient) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
        <p className="text-sm text-gray-500">
          {patient.age} anos · {patient.gender === 'M' ? 'Masculino' : 'Feminino'} · {patient.specialty}
        </p>
      </div>

      {patient.conditions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {patient.conditions.map((c: string) => (
            <span key={c} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              #{c}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Estado clínico</p>
        <p className="text-gray-600">{patient.clinical_status}</p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-1">Vínculo</p>
        <BondBar level={patient.bond_level} />
      </div>

      <Link href={STUB_CONSULTATION_ROUTE} className="btn btn--primary">
        Iniciar atendimento
      </Link>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Consultas anteriores</h2>
        <p className="text-gray-400 text-sm">Nenhuma consulta realizada ainda.</p>
      </div>
    </div>
  )
}
