import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { managedInstitutions } from '@/lib/faculty/access'

export const dynamic = 'force-dynamic'

export default async function FacultyHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { isAdmin, institutions } = await managedInstitutions(user.id, user.email)
  if (!isAdmin && institutions.length === 0) notFound()
  // Diretor de uma única instituição entra direto nela.
  if (!isAdmin && institutions.length === 1) redirect(`/faculdade/${institutions[0].id}`)

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-1 sm:p-2">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Painel da faculdade</h1>
        <p className="text-sm text-muted">
          {isAdmin ? 'Pré-visualização do dono — escolha uma instituição para ver o que o diretor enxerga.' : 'Selecione a instituição.'}
        </p>
      </header>
      {institutions.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Nenhuma instituição cadastrada ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {institutions.map((i) => (
            <Link key={i.id} href={`/faculdade/${i.id}`}
              className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary">
              <p className="font-semibold text-ink">{i.name}</p>
              <p className="mt-1 text-xs text-muted">
                {i.faculty_match ? `Faculdade: ${i.faculty_match}` : 'Sem faculdade vinculada'}
                {i.founder_code ? ` · cupom ${i.founder_code}` : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
