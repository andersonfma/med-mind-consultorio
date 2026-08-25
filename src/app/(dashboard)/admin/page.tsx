import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'

export const dynamic = 'force-dynamic'

// Allowlist de admins por e-mail (server-side). Configurável via env
// ADMIN_EMAILS (lista separada por vírgula); default = dono do projeto.
// user.email vem de getUser(), validado no servidor pelo Supabase — confiável.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'andersonbrito.a@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

function fmt(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  // Só admin acessa — 404 esconde a existência da página dos demais.
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) notFound()

  // A partir daqui: confirmado admin → pode ler todos os usuários (bypassa RLS).
  const admin = createAdminClient()

  const [usersRes, profilesRes, patientsRes, consultationsRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('profiles').select('id, full_name, ai_calls_used, ai_calls_limit'),
    admin.from('patients').select('user_id'),
    admin.from('consultations').select('user_id, status'),
  ])

  const authUsers = usersRes.data?.users ?? []
  const profiles = (profilesRes.data ?? []) as Array<{
    id: string
    full_name: string | null
    ai_calls_used: number | null
    ai_calls_limit: number | null
  }>
  const patients = (patientsRes.data ?? []) as Array<{ user_id: string }>
  const consultations = (consultationsRes.data ?? []) as Array<{ user_id: string; status: string }>

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const patientCount = new Map<string, number>()
  for (const p of patients) patientCount.set(p.user_id, (patientCount.get(p.user_id) ?? 0) + 1)
  const consultTotal = new Map<string, number>()
  const consultFinished = new Map<string, number>()
  for (const c of consultations) {
    consultTotal.set(c.user_id, (consultTotal.get(c.user_id) ?? 0) + 1)
    if (c.status === 'finished')
      consultFinished.set(c.user_id, (consultFinished.get(c.user_id) ?? 0) + 1)
  }

  const rows = authUsers
    .map((u) => {
      const prof = profileById.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '—',
        name: prof?.full_name ?? '—',
        created: u.created_at,
        lastSignIn: u.last_sign_in_at,
        patients: patientCount.get(u.id) ?? 0,
        consults: consultTotal.get(u.id) ?? 0,
        finished: consultFinished.get(u.id) ?? 0,
        aiUsed: prof?.ai_calls_used ?? 0,
        aiLimit: prof?.ai_calls_limit ?? 0,
      }
    })
    .sort((a, b) => (b.lastSignIn ? Date.parse(b.lastSignIn) : 0) - (a.lastSignIn ? Date.parse(a.lastSignIn) : 0))

  const totals = {
    users: rows.length,
    patients: rows.reduce((s, r) => s + r.patients, 0),
    consults: rows.reduce((s, r) => s + r.consults, 0),
    aiUsed: rows.reduce((s, r) => s + r.aiUsed, 0),
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Admin — acompanhamento de uso</h1>
        <p className="text-sm text-muted">
          {totals.users} usuários · {totals.patients} pacientes · {totals.consults} consultas ·{' '}
          {totals.aiUsed} chamadas de IA no período
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
              <th className="px-4 py-3 font-medium">Último login</th>
              <th className="px-4 py-3 font-medium text-right">Pacientes</th>
              <th className="px-4 py-3 font-medium text-right">Consultas</th>
              <th className="px-4 py-3 font-medium text-right">Finalizadas</th>
              <th className="px-4 py-3 font-medium text-right">IA usada</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Nenhum usuário ainda.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{r.name}</div>
                  <div className="text-xs text-muted">{r.email}</div>
                </td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">{fmt(r.created)}</td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">{fmt(r.lastSignIn)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{r.patients}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{r.consults}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{r.finished}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  <span className={r.aiUsed >= r.aiLimit && r.aiLimit > 0 ? 'font-semibold text-danger' : 'text-ink'}>
                    {r.aiUsed}
                  </span>
                  <span className="text-muted">/{r.aiLimit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
