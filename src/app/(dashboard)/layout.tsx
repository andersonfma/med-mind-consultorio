import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/layout/Shell'
import { LOGIN_ROUTE } from '@/lib/routes'

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

  return <Shell>{children}</Shell>
}
