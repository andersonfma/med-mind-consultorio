import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import {
  computeLeaderboard,
  weekStartISO,
  type ConsultRow,
  type ProfileRow,
} from '@/lib/scoring/leaderboard'
import { RankingTabs } from './RankingTabs'
import { OptInCard } from './OptInCard'

export const dynamic = 'force-dynamic'

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const admin = createAdminClient()

  const weekStart = weekStartISO(new Date())
  const [allRes, weekRes, allMcRes, weekMcRes, profRes, myProfRes] = await Promise.all([
    admin.from('consultations').select('user_id, points').eq('status', 'finished').gt('points', 0),
    admin.from('consultations').select('user_id, points').eq('status', 'finished').gt('points', 0).gte('finished_at', weekStart),
    admin.from('medcoin_events').select('user_id, points'),
    admin.from('medcoin_events').select('user_id, points').gte('created_at', weekStart),
    admin.from('profiles').select('id, full_name, leaderboard_optin, leaderboard_alias'),
    admin.from('profiles').select('leaderboard_optin, leaderboard_alias').eq('id', user.id).single(),
  ])

  // MedCoin = moeda única: o ranking soma consultas + ledger (mesmas linhas {user_id, points}).
  const allRows = [...((allRes.data ?? []) as ConsultRow[]), ...((allMcRes.data ?? []) as ConsultRow[])]
  const weekRows = [...((weekRes.data ?? []) as ConsultRow[]), ...((weekMcRes.data ?? []) as ConsultRow[])]
  const profiles = (profRes.data ?? []) as ProfileRow[]
  const myProf = (myProfRes.data ?? null) as { leaderboard_optin?: boolean | null; leaderboard_alias?: string | null } | null

  const all = computeLeaderboard(allRows, profiles, user.id)
  const week = computeLeaderboard(weekRows, profiles, user.id)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Ranking</h1>
        <p className="mt-1 text-sm text-muted">
          MedCoin por consulta concluída e pelo desafio diário — volume × qualidade do raciocínio.
        </p>
      </header>

      <OptInCard
        initialOptin={!!myProf?.leaderboard_optin}
        initialAlias={myProf?.leaderboard_alias ?? ''}
      />

      <RankingTabs week={week} all={all} />
    </div>
  )
}
