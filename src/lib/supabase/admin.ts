import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Client service_role — BYPASSA o RLS. Use SOMENTE em código server-side e
 * SOMENTE após confirmar que o solicitante é admin.
 *
 * Intencionalmente SEM o generic <Database>: assim não trava em colunas/RPCs
 * recentes (ai_calls_*, consume_ai_call) ainda não presentes nos tipos gerados,
 * e libera o uso de auth.admin.* (listUsers etc.).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
