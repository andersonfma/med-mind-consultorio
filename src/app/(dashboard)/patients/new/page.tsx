import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '@/lib/routes'
import { NewPatientForm } from './NewPatientForm'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const [patientsCount, profileResult] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('total_slots').eq('id', user.id).single(),
  ])

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data) throw new Error('Profile not found')

  const count = patientsCount.count ?? 0

  if (count >= profileResult.data.total_slots) {
    redirect(DASHBOARD_ROUTE)
  }

  return <NewPatientForm />
}
