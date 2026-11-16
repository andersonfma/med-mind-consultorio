import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/layout/Shell'
import { LOGIN_ROUTE } from '@/lib/routes'
import { isAdminEmail } from '@/lib/admin/access'
import { canAccessFaculty } from '@/lib/faculty/access'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(LOGIN_ROUTE)
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .maybeSingle()
  const isPremium = !!(prof as { is_premium?: boolean } | null)?.is_premium
  const isAdmin = isAdminEmail(user.email)
  const canFaculty = isAdmin || (await canAccessFaculty(user.id, user.email))

  return <Shell isAdmin={isAdmin} isPremium={isPremium} canFaculty={canFaculty}>{children}</Shell>
}
