import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, patientDetailRoute } from '@/lib/routes'
import { hasAvailableSlot } from '@/lib/patients/slots'
import { BondBar } from '@/components/ui/BondBar'
import { PlaceholderChart } from '@/components/charts/PlaceholderChart'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const [patientsResult, profileResult] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('total_slots, full_name').eq('id', user.id).single(),
  ])

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data) throw new Error('Profile not found for authenticated user')

  if (patientsResult.error) {
    console.error('Failed to load patients:', patientsResult.error)
  }

  const patients = patientsResult.data ?? []
  const { total_slots, full_name } = profileResult.data
  const used_slots = patientsResult.count ?? patients.length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{full_name}</h1>
          <p className="text-sm text-gray-500">Reputação: 0 pts</p>
        </div>
        {hasAvailableSlot(used_slots, total_slots) ? (
          <Link href="/patients/new" className="btn btn--primary">
            Novo paciente
          </Link>
        ) : (
          <button
            disabled
            title="Aumente sua reputação para desbloquear novos pacientes"
            className="btn btn--primary"
          >
            Novo paciente
          </button>
        )}
      </div>

      <div className="flex gap-6">
        <div className="w-2/5">
          <p className="text-sm text-gray-500 mb-3">
            {used_slots} / {total_slots} slots utilizados
          </p>
          {patients.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum paciente ainda.</p>
          ) : (
            <ul className="space-y-3">
              {patients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={patientDetailRoute(patient.id)}
                    className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800">{patient.name}</span>
                      <span className="text-xs text-gray-400">{patient.specialty}</span>
                    </div>
                    <BondBar level={patient.bond_level} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-3/5 space-y-4">
          <PlaceholderChart title="Desempenho AB4" description="Eixos A1–A4 do método AB4" />
          <PlaceholderChart title="Reputação" description="Evolução ao longo do tempo" />
          <PlaceholderChart title="Volume de atendimentos" description="Consultas por semana" />
        </div>
      </div>
    </div>
  )
}
