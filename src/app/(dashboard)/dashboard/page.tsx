import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, patientDetailRoute } from '@/lib/routes'
import { hasAvailableSlot } from '@/lib/patients/slots'
import { BondBar } from '@/components/ui/BondBar'
import { PlaceholderChart } from '@/components/charts/PlaceholderChart'
import { getRadarData } from '@/lib/performance/loader'
import { PerformanceRadar } from './PerformanceRadar'

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

  const radar = await getRadarData(supabase, user.id)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{full_name}</h1>
          <p className="text-sm text-muted">Reputação: 0 pts</p>
        </div>
        {hasAvailableSlot(used_slots, total_slots) ? (
          <Link
            href="/patients/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-button)] transition-colors hover:bg-primary-hover"
          >
            Novo paciente
          </Link>
        ) : (
          <button
            disabled
            title="Aumente sua reputação para desbloquear novos pacientes"
            className="inline-flex cursor-not-allowed items-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-muted"
          >
            Novo paciente
          </button>
        )}
      </div>

      <div className="flex gap-6">
        <div className="w-2/5">
          <p className="text-sm text-muted mb-3">
            {used_slots} / {total_slots} slots utilizados
          </p>
          {patients.length === 0 ? (
            <p className="text-muted text-sm">Nenhum paciente ainda.</p>
          ) : (
            <ul className="space-y-3">
              {patients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={patientDetailRoute(patient.id)}
                    className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-ink">{patient.name}</span>
                      <span className="text-xs text-muted">{patient.specialty}</span>
                    </div>
                    <BondBar level={patient.bond_level} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-3/5 space-y-4">
          <PerformanceRadar result={radar} />
          <PlaceholderChart title="Reputação" description="Evolução ao longo do tempo" />
          <PlaceholderChart title="Volume de atendimentos" description="Consultas por semana" />
        </div>
      </div>
    </div>
  )
}
