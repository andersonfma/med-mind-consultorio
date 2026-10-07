import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, shareCardRoute } from '@/lib/routes'
import { PublishResultButton } from './PublishResultButton'

export const dynamic = 'force-dynamic'

export default async function ResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { data } = await supabase.from('consultations').select('*').eq('user_id', user.id).eq('status', 'finished').order('finished_at', { ascending: false }).limit(50)
  const rows = (data ?? []) as unknown as Array<{ id: string; finished_at: string | null; points: number | null }>

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink">Meus resultados</h1>
      {rows.length === 0 ? <p className="text-sm text-muted">Você ainda não finalizou consultas.</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shareCardRoute(r.id)} alt="" className="mb-3 w-full rounded-lg border border-border" />
              <PublishResultButton consultationId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
