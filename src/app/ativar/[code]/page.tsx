import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Link curto de ativação de código de fundador (compartilhável no WhatsApp).
// Logado -> vai direto para /premium com o código pré-preenchido.
// Não logado -> vai para o cadastro e, após entrar/confirmar, cai no /premium com o código.
export default async function AtivarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const c = encodeURIComponent((code || '').trim().toUpperCase().slice(0, 24))
  const dest = `/premium?code=${c}`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(dest)
  redirect(`/register?next=${encodeURIComponent(dest)}`)
}
