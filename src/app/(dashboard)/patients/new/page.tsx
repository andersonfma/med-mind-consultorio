import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { NewPatientForm } from './NewPatientForm'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const MONTHLY_CAP = 5
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [monthly, profileResult] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('profiles').select('is_premium, free_specialties').eq('id', user.id).single(),
  ])

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data) throw new Error('Profile not found')

  const prof = profileResult.data as unknown as { is_premium: boolean | null; free_specialties: string[] | null }

  return (
    <NewPatientForm
      isPremium={!!prof.is_premium}
      freeSpecialties={prof.free_specialties ?? []}
      monthlyUsed={monthly.count ?? 0}
      monthlyCap={MONTHLY_CAP}
    />
  )
}
