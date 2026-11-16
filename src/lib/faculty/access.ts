import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'

export type ManagedInstitution = { id: string; name: string; founder_code: string | null; faculty_match: string | null }

/**
 * Instituições que um usuário pode ver no painel de faculdade.
 * - Dono (admin por e-mail): TODAS — pode pré-visualizar qualquer faculdade.
 * - Diretor/coordenador: só as instituições em institution_managers.
 * Retorna [] se não gerencia nenhuma (e não é admin).
 */
export async function managedInstitutions(
  userId: string,
  email: string | null | undefined,
): Promise<{ isAdmin: boolean; institutions: ManagedInstitution[] }> {
  const admin = createAdminClient()
  const isAdmin = isAdminEmail(email)

  if (isAdmin) {
    const { data } = await admin
      .from('institutions')
      .select('id, name, founder_code, faculty_match')
      .order('name')
    return { isAdmin: true, institutions: (data ?? []) as ManagedInstitution[] }
  }

  const { data: links } = await admin
    .from('institution_managers')
    .select('institution_id')
    .eq('user_id', userId)
  const ids = ((links ?? []) as Array<{ institution_id: string }>).map((l) => l.institution_id)
  if (ids.length === 0) return { isAdmin: false, institutions: [] }

  const { data } = await admin
    .from('institutions')
    .select('id, name, founder_code, faculty_match')
    .in('id', ids)
    .order('name')
  return { isAdmin: false, institutions: (data ?? []) as ManagedInstitution[] }
}

/** True se o usuário pode acessar o painel de faculdade (admin ou gestor). */
export async function canAccessFaculty(userId: string, email: string | null | undefined): Promise<boolean> {
  if (isAdminEmail(email)) return true
  const admin = createAdminClient()
  const { count } = await admin
    .from('institution_managers')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return (count ?? 0) > 0
}
