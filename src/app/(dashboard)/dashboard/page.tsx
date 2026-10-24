import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withClockSkewRetry } from '@/lib/supabase/retry'
import { LOGIN_ROUTE, patientDetailRoute } from '@/lib/routes'
import { getChallengeToday } from '@/lib/challenge/today'
import { ChallengeBanner } from '../feed/ChallengeBanner'
import { BondBar } from '@/components/ui/BondBar'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { ScoresChart } from '@/components/charts/ScoresChart'
import { getRadarData } from '@/lib/performance/loader'
import { getDashboardCharts } from '@/lib/performance/dashboard-charts'
import { PerformanceRadar } from './PerformanceRadar'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const [patientsResult, profileResult] = await Promise.all([
    withClockSkewRetry(() =>
      supabase.from('patients').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
    ),
    withClockSkewRetry(() =>
      supabase.from('profiles').select('is_premium, full_name').eq('id', user.id).single(),
    ),
  ])

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data) throw new Error('Profile not found for authenticated user')

  if (patientsResult.error) {
    console.error('Failed to load patients:', patientsResult.error)
  }

  const patients = patientsResult.data ?? []
  const { is_premium, full_name } = profileResult.data as unknown as { is_premium: boolean | null; full_name: string | null }
  const MONTHLY_CAP = 5
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const monthlyUsed = patients.filter((p) => Date.parse(p.created_at) >= cutoff).length
  const canCreate = !!is_premium || monthlyUsed < MONTHLY_CAP

  const admin = createAdminClient()
  const [radar, charts, challenge] = await Promise.all([
    getRadarData(supabase, user.id),
    getDashboardCharts(supabase, user.id),
    getChallengeToday(admin, user.id, new Date().toISOString().slice(0, 10)),
  ])
  const todayDay = challenge.days.find((d) => d.dayIndex === challenge.todayDayIndex) ?? null
  const challengeBanner = challenge.case && todayDay
    ? { title: challenge.case.title, stage: todayDay.stage, answered: !!todayDay.answered, streak: challenge.streak }
    : null

  return (
    <div className="p-6">
      {challengeBanner && <div className="mb-6"><ChallengeBanner {...challengeBanner} /></div>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{full_name}</h1>
          <p className="text-sm text-muted">Reputação: 0 pts</p>
          <Link href="/resultados" className="text-xs font-medium text-primary hover:underline">Meus resultados →</Link>
        </div>
        {canCreate ? (
          <Link
            href="/patients/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover"
          >
            Novo paciente
          </Link>
        ) : (
          <button
            disabled
            title="Limite mensal do plano grátis atingido. Assine o premium para casos ilimitados."
            className="inline-flex cursor-not-allowed items-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-muted"
          >
            Novo paciente
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-2/5">
          <p className="text-sm text-muted mb-3">
            {is_premium
              ? <span style={{ color: '#E7B23A' }}>✦ Premium · casos ilimitados</span>
              : <>Casos este mês: {monthlyUsed} / {MONTHLY_CAP} · <Link href="/premium" className="font-medium" style={{ color: '#E7B23A' }}>Seja Premium ✦</Link></>}
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

        <div className="w-full lg:w-3/5 space-y-4">
          <PerformanceRadar result={radar} />
          <ScoresChart data={charts.scores} />
          <VolumeChart data={charts.volume} total={charts.totalFinished} />
        </div>
      </div>
    </div>
  )
}
