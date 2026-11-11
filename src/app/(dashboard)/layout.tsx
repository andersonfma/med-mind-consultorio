import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/layout/Shell'
import { LOGIN_ROUTE } from '@/lib/routes'
import { isAdminEmail } from '@/lib/admin/access'

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

  return <Shell isAdmin={isAdminEmail(user.email)} isPremium={isPremium}>{children}</Shell>
}
