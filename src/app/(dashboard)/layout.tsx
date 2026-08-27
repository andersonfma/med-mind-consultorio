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

  return <Shell isAdmin={isAdminEmail(user.email)}>{children}</Shell>
}
